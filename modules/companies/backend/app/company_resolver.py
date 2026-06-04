import json
import re
import unicodedata
from datetime import UTC, datetime
from html import unescape
from html.parser import HTMLParser
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from fastapi import HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from .config import settings


class BankAccountResponse(BaseModel):
    Ucet: str
    Banka: str | None = None


class StatutaryResponse(BaseModel):
    StatutarnyOrgan: str | None = None
    StatutarnyOrganFunkcia: str | None = None


class OrganizationResponse(BaseModel):
    Ico: str
    Meno: str
    Dic: str | None = None
    IcDph: str | None = None
    PlnaAdresa: str | None = None
    Mesto: str | None = None
    Ulica: str | None = None
    CisloDomu: str | None = None
    Stat: str | None = None
    Psc: str | None = None
    Statutary: list[StatutaryResponse] = Field(default_factory=list)
    BankoveUcty: list[BankAccountResponse] = Field(default_factory=list)
    Vytvorene: str
    Updatovane: str


class FinanceBankAccount(BaseModel):
    account: str
    bank: str | None = None


class FinanceRegistration(BaseModel):
    dic: str | None = None
    icdph: str | None = None
    bank_accounts: list[FinanceBankAccount] = Field(default_factory=list)


class FinanceRegistrationReference(BaseModel):
    identifier: str


class LegalPersonReference(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    section: str
    insert_number: str = Field(alias="insertNumber")
    court: str


class ExternalOrganizationRegistration(BaseModel):
    Ico: str
    Meno: str
    PlnaAdresa: str | None = None
    Mesto: str | None = None
    Ulica: str | None = None
    CisloDomu: str | None = None
    Stat: str
    Psc: str | None = None
    Statutary: list[StatutaryResponse] = Field(default_factory=list)
    Vytvorene: str
    Updatovane: str


class _Address:
    def __init__(
        self,
        full: str | None = None,
        city: str | None = None,
        street: str | None = None,
        building_number: str | None = None,
        postal_code: str | None = None,
    ) -> None:
        self.full = full
        self.city = city
        self.street = street
        self.building_number = building_number
        self.postal_code = postal_code


class _TableRowsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[tuple[list[str], list[str]]] = []
        self._in_row = False
        self._in_cell = False
        self._current_row: list[str] = []
        self._current_links: list[str] = []
        self._current_cell: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self._in_row = True
            self._current_row = []
            self._current_links = []
        elif self._in_row and tag in {"td", "th"}:
            self._in_cell = True
            self._current_cell = []
        elif self._in_cell and tag == "br":
            self._current_cell.append(" ")
        elif self._in_row and tag == "a":
            href = _attribute_value(attrs, "href")
            if href:
                self._current_links.append(href)

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._current_cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._in_cell and tag in {"td", "th"}:
            self._current_row.append(_normalize_text(" ".join(self._current_cell)))
            self._in_cell = False
            self._current_cell = []
        elif self._in_row and tag == "tr":
            if any(self._current_row):
                self.rows.append((self._current_row, self._current_links))
            self._in_row = False
            self._current_row = []
            self._current_links = []


class _BankAccountsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lines: list[str] = []
        self._in_paragraph = False
        self._collecting = False
        self._current_line: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "p":
            self._in_paragraph = True
        elif self._collecting and tag == "br":
            self._append_current_line()

    def handle_data(self, data: str) -> None:
        if not self._in_paragraph:
            return

        if _normalize_label(data) == "bankove ucty":
            self._collecting = True
            return

        if self._collecting:
            self._current_line.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._in_paragraph and tag == "p":
            self._append_current_line()
            self._in_paragraph = False
            self._collecting = False
            self._current_line = []

    def _append_current_line(self) -> None:
        line = _normalize_text(" ".join(self._current_line))
        if line:
            self.lines.append(line)
        self._current_line = []


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self._current_href = ""
        self._current_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            self._current_href = _attribute_value(attrs, "href")
            self._current_text = []

    def handle_data(self, data: str) -> None:
        if self._current_href:
            self._current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._current_href:
            self.links.append((self._current_href, _normalize_text(" ".join(self._current_text))))
            self._current_href = ""
            self._current_text = []


class _DivRowsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[tuple[str, str]] = []
        self._row_depth = 0
        self._cell_depth = 0
        self._current_cells: list[str] = []
        self._current_cell: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = _attribute_value(attrs, "class").split()
        if self._cell_depth:
            self._cell_depth += 1
            if tag == "br":
                self._current_cell.append(" ")
        elif tag == "div" and "div-row" in classes:
            self._row_depth += 1
            if self._row_depth == 1:
                self._current_cells = []
        elif tag == "div" and self._row_depth == 1 and self._cell_depth == 0 and "div-cell" in classes:
            self._cell_depth = 1
            self._current_cell = []
        elif tag == "br":
            self._current_cell.append(" ")

    def handle_data(self, data: str) -> None:
        if self._cell_depth:
            self._current_cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "div":
            return

        if self._cell_depth:
            self._cell_depth -= 1
            if self._cell_depth == 0:
                self._current_cells.append(_normalize_text(" ".join(self._current_cell)))
                self._current_cell = []
            return

        if self._row_depth:
            self._row_depth -= 1
            if self._row_depth == 0 and len(self._current_cells) >= 2:
                label = _normalize_text(self._current_cells[0]).rstrip(":")
                value = _normalize_text(" ".join(self._current_cells[1:]))
                if label or value:
                    self.rows.append((label, value))


class _TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text: list[str] = []

    def handle_data(self, data: str) -> None:
        self.text.append(data)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"br", "hr"}:
            self.text.append(" ")


def resolve_company_by_ico(identification_number: str, country: str = "SK") -> OrganizationResponse:
    register = _read_register_organization(identification_number, country)
    finance = _read_finance_registration_or_empty(identification_number)

    return OrganizationResponse(
        Ico=register.Ico,
        Meno=register.Meno,
        Dic=_dic_value(finance, register),
        IcDph=finance.icdph,
        PlnaAdresa=register.PlnaAdresa,
        Mesto=register.Mesto,
        Ulica=register.Ulica,
        CisloDomu=register.CisloDomu,
        Stat=register.Stat,
        Psc=register.Psc,
        Statutary=register.Statutary,
        BankoveUcty=[
            BankAccountResponse(Ucet=bank_account.account, Banka=bank_account.bank)
            for bank_account in finance.bank_accounts
        ],
        Vytvorene=register.Vytvorene,
        Updatovane=register.Updatovane,
    )


def _read_register_organization(identification_number: str, country: str) -> ExternalOrganizationRegistration:
    normalized_country = _normalize_country(country)
    if normalized_country == "CZ":
        return _read_orcz(identification_number)

    if normalized_country != "SK":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported organization country. Use SK or CZ.",
        )

    return _read_orsr(identification_number)


def _read_finance_registration_or_empty(identification_number: str) -> FinanceRegistration:
    try:
        return _read_finance_registration(identification_number)
    except HTTPException:
        return FinanceRegistration()


def _read_finance_registration(identification_number: str) -> FinanceRegistration:
    search_html = _finance_get_html("/subjekty", {"hladaj": str(identification_number)}, "FinReg search")
    reference = _to_finance_registration_reference(search_html, str(identification_number))
    detail_html = _finance_get_html(f"/subjekt/{reference.identifier}", {}, "FinReg detail")
    return _to_finance_registration(detail_html)


def _finance_get_html(path: str, params: dict[str, Any], source: str) -> str:
    url = urljoin(settings.register_finance_base_url, path)
    if params:
        url = f"{url}?{urlencode(params)}"

    body = _urlopen_bytes(url, "text/html", settings.register_finance_timeout_seconds, source)
    return body.decode("utf-8", errors="replace")


def _to_finance_registration_reference(html: str, identification_number: str) -> FinanceRegistrationReference:
    parser = _TableRowsParser()
    parser.feed(html)

    for row, links in parser.rows:
        row_text = _normalize_text(" ".join(row))
        if not re.search(rf"\b{re.escape(identification_number)}\b", row_text):
            continue

        for link in links:
            match = re.fullmatch(r"/subjekt/(\d+)\s*", link)
            if match:
                return FinanceRegistrationReference(identifier=match.group(1))

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FinReg subject not found: {identification_number}")


def _to_finance_registration(html: str) -> FinanceRegistration:
    parser = _TableRowsParser()
    parser.feed(html)
    bank_accounts = _bank_accounts(html)

    dic = None
    icdph = None
    for row, _links in parser.rows:
        if len(row) < 2:
            continue

        label = _normalize_label(row[0])
        value = _normalize_text(row[1])
        if label == "dic":
            dic = _tax_id_value(value)
        elif label == "ic dph":
            icdph = _vat_id_value(value)

    return FinanceRegistration(dic=dic, icdph=icdph, bank_accounts=bank_accounts)


def _bank_accounts(html: str) -> list[FinanceBankAccount]:
    parser = _BankAccountsParser()
    parser.feed(html)

    accounts = []
    for line in parser.lines:
        account = _account_value(line)
        if not account:
            continue

        bank = line.replace(account, "", 1).strip() or None
        accounts.append(FinanceBankAccount(account=account, bank=bank))

    return accounts


def _read_orsr(identification_number: str) -> ExternalOrganizationRegistration:
    reference = _search_legal_person_reference(str(identification_number))
    details = _read_legal_person_details(reference)
    return _to_orsr_registration(details, identification_number)


def _search_legal_person_reference(query: str) -> LegalPersonReference:
    if query is None or not query.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Register legal person query must not be empty")

    params = {
        "Skip": 0,
        "Take": 2,
        "Filter.CorporateBodyFullNameOrRegistrationNumber": query.strip(),
        "sortCriteria[0].Direction": "Ascending",
        "sortCriteria[0].FieldName": "CorporateBodyFullName",
    }
    body = _orsr_get_json("/api/legal-person", params)

    return _to_legal_person_reference(body, query)


def _read_legal_person_details(reference: LegalPersonReference) -> dict[str, Any]:
    return _orsr_get_json(
        "/api/legal-person/extract",
        {"oddiel": reference.section, "vlozka": reference.insert_number, "sud": reference.court},
    )


def _orsr_get_json(path: str, params: dict[str, Any]) -> dict[str, Any]:
    url = f"{urljoin(settings.register_orsr_base_url, path)}?{urlencode(params)}"
    request = Request(url, headers={"Accept": "application/json"})

    try:
        with urlopen(request, timeout=settings.register_orsr_timeout_seconds) as response:
            body = json.load(response)
    except HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"ORSR legal person API returned status {exc.code}") from exc
    except (TimeoutError, URLError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not fetch ORSR legal person data") from exc

    return body if isinstance(body, dict) else {}


def _to_legal_person_reference(response: Any, query: str) -> LegalPersonReference:
    if not isinstance(response, dict):
        raise _search_not_found(query)

    data = response.get("data")
    if not isinstance(data, list):
        raise _search_not_found(query)

    references = [
        _search_reference(item)
        for item in data
        if isinstance(item, dict) and isinstance(item.get("fileReference"), dict)
    ]
    if not references:
        raise _search_not_found(query)

    if len(references) > 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"External organization search is ambiguous for query: {query}")

    return references[0]


def _search_reference(item: dict[str, Any]) -> LegalPersonReference:
    file_reference = item.get("fileReference")
    if not isinstance(file_reference, dict):
        file_reference = {}

    try:
        return LegalPersonReference(
            section=_text(file_reference, "section"),
            insertNumber=_text(file_reference, "insertNumber"),
            court=_text(file_reference, "court"),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ORSR legal person search returned incomplete file reference",
        ) from exc


def _search_not_found(query: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"External organization not found: {query}")


def _to_orsr_registration(details: dict[str, Any], identification_number: str) -> ExternalOrganizationRegistration:
    legal_person = _dict(details.get("legalPerson"))
    corporate_body = _dict(legal_person.get("corporateBody"))
    address = _first_current(_list(legal_person.get("physicalAddress")))
    statutory_bodies = _current_items(_list(corporate_body.get("statutoryBody")))
    statutory_body_type = _current_value(corporate_body.get("statutoryBodyType"))
    ico = _identifier_value(legal_person) or str(identification_number)
    created = _normalize_datetime(_identifier_effective_from(legal_person)) or _normalize_datetime(_text(details, "createDateTime")) or _now()
    updated = _normalize_datetime(_text(details, "dataSyncDate")) or created

    return ExternalOrganizationRegistration(
        Ico=ico,
        Meno=_current_value(corporate_body.get("corporateBodyFullName")),
        PlnaAdresa=_format_orsr_address(address),
        Mesto=_item_text(address, "municipality"),
        Ulica=_street_name(address),
        CisloDomu=_text(address, "buildingNumber") or None,
        Stat=_country_name(address),
        Psc=_text(_dict(address.get("deliveryAddress")), "postalCode") or None,
        Statutary=_orsr_statutary_items(statutory_bodies, statutory_body_type),
        Vytvorene=created,
        Updatovane=updated,
    )


def _read_orcz(identification_number: str) -> ExternalOrganizationRegistration:
    search_html = _orcz_get_html(
        "rejstrik-$firma",
        {
            "ico": str(identification_number).strip(),
            "jenPlatne": "PLATNE",
            "polozek": 50,
            "typHledani": "STARTS_WITH",
        },
        "ORCZ search",
    )
    detail_url = _orcz_detail_url(search_html, str(identification_number))
    detail_html = _orcz_get_html(detail_url, {}, "ORCZ detail")
    return _to_orcz_registration(detail_html, identification_number)


def _orcz_get_html(path_or_url: str, params: dict[str, Any], source: str) -> str:
    url = urljoin(settings.register_orcz_base_url.rstrip("/") + "/", path_or_url)
    if params:
        url = f"{url}?{urlencode(params)}"

    body = _urlopen_bytes(url, "text/html", settings.register_orcz_timeout_seconds, source)
    return body.decode("utf-8", errors="replace")


def _orcz_detail_url(html: str, identification_number: str) -> str:
    parser = _LinkParser()
    parser.feed(html)

    matches = [
        href
        for href, text in parser.links
        if "rejstrik-firma.vysledky" in href
        and "typ=PLATNY" in href
        and _normalize_label(text) == "vypis platnych"
    ]
    if not matches:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"External organization not found: {identification_number}")

    if len(matches) > 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"External organization search is ambiguous for query: {identification_number}")

    return _with_query_parameter(matches[0], "typ", "PLATNY")


def _to_orcz_registration(html: str, identification_number: str) -> ExternalOrganizationRegistration:
    rows = _rows_by_label(html)
    name = rows.get("obchodni firma") or _field_value(html, r"Obchodn[íi] firma")
    address = rows.get("sidlo") or _field_value(html, r"S[íi]dlo")
    ico = (
        _digits(rows.get("identifikacni cislo"))
        or _digits(_field_value(html, r"Identifika[čc]n[íi] [čc][íi]slo"))
        or str(identification_number)
    )
    created = _normalize_datetime(rows.get("datum vzniku a zapisu")) or _now()
    updated = _normalize_datetime(_valid_to_date(html)) or _now()

    return ExternalOrganizationRegistration(
        Ico=ico,
        Meno=name,
        PlnaAdresa=_format_orcz_address(address),
        Mesto=_city(address),
        Ulica=_street(address),
        CisloDomu=_building_number(address),
        Stat="Česká republika",
        Psc=_postal_code(address),
        Statutary=_orcz_statutary_items(html),
        Vytvorene=created,
        Updatovane=updated,
    )


def _rows_by_label(html: str) -> dict[str, str]:
    parser = _DivRowsParser()
    parser.feed(html)

    rows = {}
    for label, value in parser.rows:
        normalized = _normalize_label(label)
        if normalized and value and normalized not in rows:
            rows[normalized] = value

    return rows


def _field_value(html: str, label_pattern: str) -> str:
    label_match = re.search(rf"<span[^>]*>\s*{label_pattern}\s*:\s*</span>", html, re.IGNORECASE)
    if not label_match:
        return ""

    value_start = html.find('id="udajVypis"', label_match.end())
    if value_start == -1:
        return ""

    div_start = html.rfind("<div", label_match.end(), value_start)
    if div_start == -1:
        return ""

    return _html_text(_balanced_div_fragment(html, div_start))


def _balanced_div_fragment(html: str, start: int) -> str:
    position = start
    depth = 0
    while True:
        match = re.search(r"</?div\b[^>]*>", html[position:], re.IGNORECASE)
        if not match:
            return html[start:]

        tag = match.group(0)
        tag_end = position + match.end()
        if tag.startswith("</"):
            depth -= 1
            if depth == 0:
                return html[start:tag_end]
        else:
            depth += 1

        position = tag_end


def _format_orcz_address(address: str | None) -> str | None:
    return _parse_orcz_address(address).full


def _city(address: str | None) -> str | None:
    return _parse_orcz_address(address).city


def _street(address: str | None) -> str | None:
    return _parse_orcz_address(address).street


def _building_number(address: str | None) -> str | None:
    return _parse_orcz_address(address).building_number


def _postal_code(address: str | None) -> str | None:
    return _parse_orcz_address(address).postal_code


def _parse_orcz_address(address: str | None) -> _Address:
    parts = [_normalize_text(part) for part in (address or "").split(",") if part.strip()]
    if not parts:
        return _Address()

    country = "Česká republika"
    parts = [part for part in parts if _normalize_label(part) != _normalize_label(country)]
    postal_code, postal_city = _postal_code_parts(parts)
    non_postal_parts = [part for part in parts if not _contains_postal_code(part)]
    street_line, city = _street_and_city(non_postal_parts, postal_city)
    street, building_number = _split_street_line(street_line)
    city_line = " ".join(part for part in (postal_code, city) if part)
    full = ", ".join(part for part in (street_line, city_line, country) if part)

    return _Address(
        full=full,
        city=city,
        street=street,
        building_number=building_number,
        postal_code=(postal_code or "").replace(" ", "") or None,
    )


def _postal_code_parts(parts: list[str]) -> tuple[str | None, str | None]:
    for part in parts:
        match = re.search(r"\bPS[CČ]\s*(\d{3})\s*(\d{2})\b", part, re.IGNORECASE)
        if match:
            return f"{match.group(1)}{match.group(2)}", _normalize_text(part[match.end() :]) or None

        match = re.search(r"\b(\d{3})\s+(\d{2})\s+(.+)$", part)
        if match:
            return f"{match.group(1)}{match.group(2)}", _normalize_text(match.group(3))

    return None, None


def _street_and_city(parts: list[str], postal_city: str | None) -> tuple[str | None, str | None]:
    street_candidates = [part for part in parts if _building_number_from_street_line(part)]
    if postal_city:
        return (street_candidates[-1] if street_candidates else (parts[-1] if parts else None)), postal_city

    if len(parts) >= 2:
        first_has_number = bool(_building_number_from_street_line(parts[0]))
        second_has_number = bool(_building_number_from_street_line(parts[1]))
        if first_has_number and not second_has_number:
            return parts[0], parts[1]
        if not first_has_number and second_has_number:
            return parts[1], parts[0]
        if first_has_number and second_has_number:
            return parts[1], parts[0]

    street_line = street_candidates[-1] if street_candidates else None
    city = next((part for part in parts if part != street_line), None)
    return street_line or (parts[0] if parts else None), city


def _split_street_line(street_line: str | None) -> tuple[str | None, str | None]:
    if not street_line:
        return None, None

    building_number = _building_number_from_street_line(street_line)
    if not building_number:
        return street_line, None

    street = street_line[: -len(building_number)].strip()
    return street or street_line, building_number


def _building_number_from_street_line(street_line: str | None) -> str | None:
    match = re.search(r"\b\d[\w/-]*$", street_line or "")
    return match.group(0) if match else None


def _contains_postal_code(part: str) -> bool:
    return bool(
        re.search(r"\bPS[CČ]\s*\d{3}\s*\d{2}\b", part, re.IGNORECASE)
        or re.search(r"\b\d{3}\s+\d{2}\b", part)
    )


def _orcz_statutary_items(html: str) -> list[StatutaryResponse]:
    section = _orcz_statutary_section(html)
    if not section:
        return []

    items: list[StatutaryResponse] = []
    for function in _orcz_statutary_functions(section):
        for name in _orcz_names_after_function(section, function):
            items.append(
                StatutaryResponse(
                    StatutarnyOrgan=name,
                    StatutarnyOrganFunkcia=_capitalize_first(function.rstrip(":")),
                )
            )

    return items


def _orcz_statutary_section(html: str) -> str:
    text = _html_text(html)
    match = re.search(
        r"Statut[áa]rn[íi] org[áa]n:\s*(.*?)(?:Po[čc]et [čc]len[ůu]:|Zp[ůu]sob jedn[áa]n[íi]:|Spole[čc]n[íi]ci:|$)",
        text,
        re.IGNORECASE,
    )
    return match.group(1) if match else ""


def _orcz_statutary_functions(section: str) -> list[str]:
    functions = []
    for match in re.finditer(r"\b(jednatel|p[řr]edseda|[čc]len(?: statut[áa]rn[íi]ho org[áa]nu)?)\s*:", section, re.IGNORECASE):
        function = _normalize_text(match.group(0))
        if function not in functions:
            functions.append(function)

    return functions


def _orcz_names_after_function(section: str, function: str) -> list[str]:
    pattern = re.compile(
        rf"{re.escape(function)}\s*(.*?)(?=\b(?:jednatel|p[řr]edseda|[čc]len(?: statut[áa]rn[íi]ho org[áa]nu)?)\s*:|$)",
        re.IGNORECASE,
    )
    names = []
    for match in pattern.finditer(section):
        name_match = re.search(r"([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^,]+?)(?:,\s*dat\. nar\.|Den vzniku funkce:)", match.group(1))
        if name_match:
            names.append(_normalize_text(name_match.group(1)))

    return names


def _valid_to_date(html: str) -> str:
    text = _html_text(html)
    match = re.search(r"[ÚU]daje platn[ée] ke dni\s+(\d{1,2}\.\d{1,2}\.\d{4}(?:\s+\d{1,2}:\d{2})?)", text)
    return match.group(1) if match else ""


def _identifier_value(legal_person: dict[str, Any]) -> str:
    for identifier in _current_items(_list(legal_person.get("id"))):
        identifier_value = _text(identifier, "identifierValue")
        if identifier_value:
            return identifier_value

    return ""


def _identifier_effective_from(legal_person: dict[str, Any]) -> str:
    for identifier in _current_items(_list(legal_person.get("id"))):
        if _text(identifier, "identifierValue"):
            return _text(identifier, "effectiveFrom")

    return ""


def _item_text(node: dict[str, Any], field: str) -> str | None:
    value = _dict(node.get(field))
    item = value.get("item")
    if isinstance(item, str):
        return item or None

    if isinstance(item, dict):
        codelist_item = _dict(item.get("codelistItem"))
        return _text(codelist_item, "itemName") or _text(item, "itemName") or None

    return None


def _street_name(address: dict[str, Any]) -> str | None:
    street = _text(address, "streetName")
    if street.startswith("ul. "):
        street = street.removeprefix("ul. ").strip()

    return street or None


def _country_name(address: dict[str, Any]) -> str:
    return _item_text(address, "country") or "Slovenská republika"


def _format_orsr_address(address: dict[str, Any]) -> str | None:
    street = _street_name(address) or ""
    building_number = _text(address, "buildingNumber")
    municipality = _item_text(address, "municipality")
    postal_code = _text(_dict(address.get("deliveryAddress")), "postalCode")
    country = _item_text(address, "country")
    street_line = " ".join(part for part in (street, building_number) if part)
    formatted = ", ".join(part for part in (street_line, postal_code, municipality, country) if part)
    return formatted or None


def _orsr_statutary_items(statutory_bodies: list[dict[str, Any]], statutory_body_type: str) -> list[StatutaryResponse]:
    statutary = []
    for statutory_body in statutory_bodies:
        name = _statutary_name(statutory_body)
        function = _statutary_function(statutory_body, statutory_body_type)
        if name or function:
            statutary.append(StatutaryResponse(StatutarnyOrgan=name, StatutarnyOrganFunkcia=function))

    return statutary


def _statutary_function(statutory_body: dict[str, Any], statutory_body_type: str) -> str | None:
    function = _text(statutory_body, "function")
    if function:
        return function

    body_type = _current_value(statutory_body.get("statutoryBodyType")) or statutory_body_type
    if body_type.lower() in ["konatelia", "konateľ"]:
        return "Konateľ"

    return None


def _statutary_name(statutory_body: dict[str, Any]) -> str | None:
    person_data = _dict(statutory_body.get("personData"))
    physical_person = _dict(person_data.get("physicalPerson"))
    person_name = _dict(physical_person.get("personName"))
    formatted_name = _text(person_name, "formattedName")
    if formatted_name:
        return formatted_name

    corporate_body = _dict(person_data.get("corporateBody"))
    corporate_name = _text(corporate_body, "corporateBodyFullName")
    return corporate_name or None


def _urlopen_bytes(url: str, accept: str, timeout: int, source: str) -> bytes:
    request = Request(url, headers={"Accept": accept, "User-Agent": "admin-flow-platform/0.1"})

    try:
        with urlopen(request, timeout=timeout) as response:
            return response.read()
    except HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"{source} returned status {exc.code}") from exc
    except (TimeoutError, URLError, OSError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not fetch {source} data") from exc


def _with_query_parameter(path_or_url: str, key: str, value: str) -> str:
    parts = urlsplit(path_or_url)
    query_items = [(item_key, item_value) for item_key, item_value in parse_qsl(parts.query, keep_blank_values=True) if item_key != key]
    query_items.append((key, value))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query_items), parts.fragment))


def _dic_value(finance: FinanceRegistration, register: ExternalOrganizationRegistration) -> str | None:
    if finance.dic:
        return finance.dic

    if register.Stat == "Česká republika" and finance.icdph and finance.icdph.upper().startswith("CZ"):
        return finance.icdph

    return None


def _tax_id_value(text: str) -> str | None:
    match = re.search(r"\b(?:[A-Z]{2})?\d{8,12}\b", text)
    return match.group(0) if match else None


def _vat_id_value(text: str) -> str | None:
    match = re.search(r"\b[A-Z]{2}\d{8,12}\b", text)
    return match.group(0) if match else None


def _account_value(text: str) -> str | None:
    match = re.search(r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b", text)
    return match.group(0) if match else None


def _normalize_datetime(value: str | None) -> str | None:
    if not value:
        return None

    stripped = value.strip()
    for date_format in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%d.%m.%Y %H:%M", "%d.%m.%Y"):
        try:
            return datetime.strptime(stripped, date_format).replace(tzinfo=UTC).isoformat()
        except ValueError:
            continue

    return stripped


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _text(node: dict[str, Any], *fields: str) -> str:
    for field in fields:
        value = node.get(field)
        if value is not None:
            text = str(value).strip()
            if text:
                return text

    return ""


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _current_items(items: list[Any]) -> list[dict[str, Any]]:
    current_items = [item for item in items if isinstance(item, dict) and item.get("current") is not False]
    return current_items or [item for item in items if isinstance(item, dict)]


def _first_current(items: list[Any]) -> dict[str, Any]:
    current_items = _current_items(items)
    return current_items[0] if current_items else {}


def _current_value(value: Any) -> str:
    if isinstance(value, str):
        return value

    if isinstance(value, list):
        current_item = _first_current(value)
        return _text(current_item, "value")

    return ""


def _html_text(html: str) -> str:
    parser = _TextParser()
    parser.feed(unescape(html))
    return _normalize_text(" ".join(parser.text))


def _attribute_value(attrs: list[tuple[str, str | None]], name: str) -> str:
    for attr_name, attr_value in attrs:
        if attr_name == name and attr_value is not None:
            return attr_value.strip()

    return ""


def _normalize_text(value: Any) -> str:
    return " ".join(str(value).replace("\xa0", " ").split())


def _normalize_label(value: Any) -> str:
    label = _normalize_text(value).replace(":", "").lower()
    return unicodedata.normalize("NFKD", label).encode("ascii", errors="ignore").decode("ascii")


def _normalize_country(country: str) -> str:
    normalized = " ".join(country.split()).casefold()
    countries = {
        "sk": "SK",
        "slovenská republika": "SK",
        "slovenska republika": "SK",
        "cz": "CZ",
        "česká republika": "CZ",
        "ceska republika": "CZ",
    }
    return countries.get(normalized, country.upper())


def _capitalize_first(value: str) -> str:
    return value[0].upper() + value[1:] if value else value


def _digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")
