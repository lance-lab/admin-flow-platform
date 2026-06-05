from typing import Annotated
from uuid import UUID

import psycopg
from fastapi import FastAPI, HTTPException, Path, Query, status
from psycopg.rows import dict_row
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config import settings
from .company_resolver import OrganizationResponse, resolve_company_by_ico

app = FastAPI(title="Companies Module API", version="0.1.0")


EU_COUNTRIES_BY_CODE = {
    "AT": "Austria",
    "BE": "Belgium",
    "BG": "Bulgaria",
    "HR": "Croatia",
    "CY": "Cyprus",
    "CZ": "Czech Republic",
    "DK": "Denmark",
    "EE": "Estonia",
    "FI": "Finland",
    "FR": "France",
    "DE": "Germany",
    "GR": "Greece",
    "HU": "Hungary",
    "IE": "Ireland",
    "IT": "Italy",
    "LV": "Latvia",
    "LT": "Lithuania",
    "LU": "Luxembourg",
    "MT": "Malta",
    "NL": "Netherlands",
    "PL": "Poland",
    "PT": "Portugal",
    "RO": "Romania",
    "SK": "Slovakia",
    "SI": "Slovenia",
    "ES": "Spain",
    "SE": "Sweden",
}
EU_COUNTRIES_BY_NAME = {country.upper(): country for country in EU_COUNTRIES_BY_CODE.values()}
PERSON_ROLE_CODES = {
    "board_member",
    "vice_chairman",
    "chairman",
    "executive_dictor",
    "owner",
}
PERSON_ROLE_ALIASES = {
    "board_member": "board_member",
    "board member": "board_member",
    "člen predstavenstva": "board_member",
    "vice_chairman": "vice_chairman",
    "vice-chairman of the board": "vice_chairman",
    "podpredseda predstavenstva": "vice_chairman",
    "chairman": "chairman",
    "chairman of the board": "chairman",
    "predseda predstavenstva": "chairman",
    "executive_dictor": "executive_dictor",
    "executive director": "executive_dictor",
    "konateľ": "executive_dictor",
    "owner": "owner",
    "majiteľ": "owner",
}


def normalize_person_role(value: object) -> str | None:
    role = str(value or "").strip()
    if not role:
        return None

    return PERSON_ROLE_ALIASES.get(role.casefold())


def db_connect():
    return psycopg.connect(settings.database_url, row_factory=dict_row)


@app.on_event("startup")
def apply_compatibility_migrations() -> None:
    with db_connect() as conn:
        conn.execute(
            """
            ALTER TABLE companies.companies
              ADD COLUMN IF NOT EXISTS contracting_authority BOOLEAN NOT NULL DEFAULT FALSE;

            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'companies'
                  AND table_name = 'company_persons'
                  AND column_name = 'surname'
              ) THEN
                UPDATE companies.company_persons
                SET name = NULLIF(TRIM(CONCAT_WS(' ', NULLIF(name, ''), NULLIF(surname, ''))), '')
                WHERE surname IS NOT NULL
                  AND TRIM(surname) <> '';

                ALTER TABLE companies.company_persons
                  DROP COLUMN surname;
              END IF;
            END $$;
            """
        )
        conn.execute(
            """
            UPDATE companies.company_persons
            SET role = CASE
              WHEN role IS NULL OR TRIM(role) = '' THEN NULL
              WHEN LOWER(role) = 'board_member' THEN 'board_member'
              WHEN LOWER(role) = 'board member' THEN 'board_member'
              WHEN LOWER(role) = 'člen predstavenstva' THEN 'board_member'
              WHEN LOWER(role) = 'vice_chairman' THEN 'vice_chairman'
              WHEN LOWER(role) = 'vice-chairman of the board' THEN 'vice_chairman'
              WHEN LOWER(role) = 'podpredseda predstavenstva' THEN 'vice_chairman'
              WHEN LOWER(role) = 'chairman' THEN 'chairman'
              WHEN LOWER(role) = 'chairman of the board' THEN 'chairman'
              WHEN LOWER(role) = 'predseda predstavenstva' THEN 'chairman'
              WHEN LOWER(role) = 'executive_dictor' THEN 'executive_dictor'
              WHEN LOWER(role) = 'executive director' THEN 'executive_dictor'
              WHEN LOWER(role) = 'konateľ' THEN 'executive_dictor'
              WHEN LOWER(role) = 'owner' THEN 'owner'
              WHEN LOWER(role) = 'majiteľ' THEN 'owner'
              ELSE NULL
            END;

            ALTER TABLE companies.company_persons
              DROP CONSTRAINT IF EXISTS company_persons_role_allowed;

            ALTER TABLE companies.company_persons
              ADD CONSTRAINT company_persons_role_allowed
              CHECK (
                role IS NULL OR role IN (
                  'board_member',
                  'vice_chairman',
                  'chairman',
                  'executive_dictor',
                  'owner'
                )
              );
            """
        )


class CompanyInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1)
    ico: str | None = None
    dic: str | None = None
    ic_dph: str | None = Field(default=None, alias="icDph")
    address_street: str | None = Field(default=None, alias="addressStreet")
    address_number: str | None = Field(default=None, alias="addressNumber")
    address_city: str | None = Field(default=None, alias="addressCity")
    address_country: str = Field(default="Slovakia", alias="addressCountry")
    address_postal_code: str | None = Field(default=None, alias="addressPostalCode")
    contracting_authority: bool = Field(default=False, alias="contractingAuthority")

    @field_validator("address_country", mode="before")
    @classmethod
    def normalize_address_country(cls, value: object) -> str:
        country = str(value or "").strip()
        if not country:
            return "Slovakia"

        normalized = country.upper()
        if normalized in EU_COUNTRIES_BY_CODE:
            return EU_COUNTRIES_BY_CODE[normalized]

        if normalized in EU_COUNTRIES_BY_NAME:
            return EU_COUNTRIES_BY_NAME[normalized]

        raise ValueError("Company country must be an EU country")


class ContactInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1)
    email: str | None = None
    phone_number: str | None = Field(default=None, alias="phoneNumber")
    date_of_birth: str | None = Field(default=None, alias="dateOfBirth")
    role: str | None = None
    preferred: bool = False

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value: object) -> str | None:
        role = normalize_person_role(value)
        if role or not str(value or "").strip():
            return role

        raise ValueError("Contact role is not supported")


class BankAccountInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    bank_account_number: str = Field(alias="bankAccountNumber", min_length=1)
    bank_code: str | None = Field(default=None, alias="bankCode")
    preferred: bool = False


CompanyId = Annotated[UUID, Path()]
ContactId = Annotated[UUID, Path()]
BankAccountId = Annotated[UUID, Path()]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "companies-api"}


@app.get("/api/overview")
def overview() -> dict[str, object]:
    return {
        "module": "companies",
        "status": "Ready",
        "capabilities": [
            "Company creation",
            "Contact assignment",
            "Bank account management",
            "Tender participant reuse",
        ],
    }


@app.get("/api/companies")
def list_companies() -> dict[str, object]:
    with db_connect() as conn:
        rows = conn.execute(
            """
            SELECT
              c.id::text AS id,
              c.name,
              c.ico,
              c.dic,
              c.ic_dph AS "icDph",
              c.address_street AS "addressStreet",
              c.address_number AS "addressNumber",
              c.address_city AS "addressCity",
              c.address_country AS "addressCountry",
              c.address_postal_code AS "addressPostalCode",
              c.contracting_authority AS "contractingAuthority",
              COUNT(DISTINCT cp.id)::int AS "contactCount",
              COUNT(DISTINCT cba.id)::int AS "bankAccountCount"
            FROM companies.companies c
            LEFT JOIN companies.company_persons cp ON cp.company_id = c.id
            LEFT JOIN companies.company_bank_accounts cba ON cba.company_id = c.id
            GROUP BY c.id
            ORDER BY c.name ASC
            """
        ).fetchall()

    return {"companies": rows}


@app.post("/api/companies", status_code=status.HTTP_201_CREATED)
def create_company(input_data: CompanyInput) -> dict[str, object]:
    with db_connect() as conn:
        try:
            company = conn.execute(
                """
                INSERT INTO companies.companies (
                  name,
                  ico,
                  dic,
                  ic_dph,
                  address_street,
                  address_number,
                  address_city,
                  address_country,
                  address_postal_code,
                  contracting_authority
                )
                VALUES (
                  %(name)s,
                  %(ico)s,
                  %(dic)s,
                  %(ic_dph)s,
                  %(address_street)s,
                  %(address_number)s,
                  %(address_city)s,
                  %(address_country)s,
                  %(address_postal_code)s,
                  %(contracting_authority)s
                )
                RETURNING
                  id::text AS id,
                  name,
                  ico,
                  dic,
                  ic_dph AS "icDph",
                  address_street AS "addressStreet",
                  address_number AS "addressNumber",
                  address_city AS "addressCity",
                  address_country AS "addressCountry",
                  address_postal_code AS "addressPostalCode",
                  contracting_authority AS "contractingAuthority"
                """,
                input_data.model_dump(),
            ).fetchone()
        except psycopg.errors.UniqueViolation as error:
            raise HTTPException(status_code=409, detail="Company ICO already exists") from error

    return {"company": company}


@app.patch("/api/companies/{company_id}")
def update_company(company_id: CompanyId, input_data: CompanyInput) -> dict[str, object]:
    with db_connect() as conn:
        try:
            company = conn.execute(
                """
                UPDATE companies.companies
                SET
                  name = %(name)s,
                  ico = %(ico)s,
                  dic = %(dic)s,
                  ic_dph = %(ic_dph)s,
                  address_street = %(address_street)s,
                  address_number = %(address_number)s,
                  address_city = %(address_city)s,
                  address_country = %(address_country)s,
                  address_postal_code = %(address_postal_code)s,
                  contracting_authority = %(contracting_authority)s
                WHERE id = %(company_id)s
                RETURNING
                  id::text AS id,
                  name,
                  ico,
                  dic,
                  ic_dph AS "icDph",
                  address_street AS "addressStreet",
                  address_number AS "addressNumber",
                  address_city AS "addressCity",
                  address_country AS "addressCountry",
                  address_postal_code AS "addressPostalCode",
                  contracting_authority AS "contractingAuthority"
                """,
                {"company_id": company_id, **input_data.model_dump()},
            ).fetchone()
        except psycopg.errors.UniqueViolation as error:
            raise HTTPException(status_code=409, detail="Company ICO already exists") from error

        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

    return {"company": company}


@app.get("/api/companies/resolve/{identification_number}")
def resolve_company(
    identification_number: str,
    country: str = Query("SK"),
) -> OrganizationResponse:
    return resolve_company_by_ico(identification_number, country)


@app.get("/api/companies/{company_id}")
def get_company(company_id: CompanyId) -> dict[str, object]:
    with db_connect() as conn:
        company = conn.execute(
            """
            SELECT
              id::text AS id,
              name,
              ico,
              dic,
              ic_dph AS "icDph",
              address_street AS "addressStreet",
              address_number AS "addressNumber",
              address_city AS "addressCity",
              address_country AS "addressCountry",
              address_postal_code AS "addressPostalCode",
              contracting_authority AS "contractingAuthority"
            FROM companies.companies
            WHERE id = %(company_id)s
            """,
            {"company_id": company_id},
        ).fetchone()

        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        contacts = conn.execute(
            """
            SELECT
              cp.id::text AS id,
              cp.name,
              cp.email,
              cp.phone_number AS "phoneNumber",
              cp.date_of_birth::text AS "dateOfBirth",
              cp.role,
              cp.preferred
            FROM companies.company_persons cp
            WHERE cp.company_id = %(company_id)s
            ORDER BY cp.preferred DESC, cp.name ASC
            """,
            {"company_id": company_id},
        ).fetchall()

        bank_accounts = conn.execute(
            """
            SELECT
              id::text AS id,
              bank_account_number AS "bankAccountNumber",
              bank_code AS "bankCode",
              preferred
            FROM companies.company_bank_accounts
            WHERE company_id = %(company_id)s
            ORDER BY preferred DESC, bank_account_number ASC
            """,
            {"company_id": company_id},
        ).fetchall()

    return {"company": {**company, "contacts": contacts, "bankAccounts": bank_accounts}}


@app.delete("/api/companies/{company_id}")
def delete_company(company_id: CompanyId) -> dict[str, bool]:
    with db_connect() as conn:
        company = conn.execute(
            "SELECT id FROM companies.companies WHERE id = %(company_id)s",
            {"company_id": company_id},
        ).fetchone()

        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        dependency = conn.execute(
            """
            SELECT COUNT(*)::int AS count
            FROM tenders.tender_companies
            WHERE company_id = %(company_id)s
            """,
            {"company_id": company_id},
        ).fetchone()

        if dependency and dependency["count"] > 0:
            raise HTTPException(
                status_code=409,
                detail="Company is used in tenders and cannot be deleted",
            )

        conn.execute(
            "DELETE FROM companies.companies WHERE id = %(company_id)s",
            {"company_id": company_id},
        )

    return {"success": True}


@app.post("/api/companies/{company_id}/contacts", status_code=status.HTTP_201_CREATED)
def create_contact(company_id: CompanyId, input_data: ContactInput) -> dict[str, object]:
    with db_connect() as conn:
        company = conn.execute(
            "SELECT id FROM companies.companies WHERE id = %(company_id)s",
            {"company_id": company_id},
        ).fetchone()

        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        contact = conn.execute(
            """
            INSERT INTO companies.company_persons (
              company_id,
              name,
              email,
              phone_number,
              date_of_birth,
              role,
              preferred
            )
            VALUES (
              %(company_id)s,
              %(name)s,
              %(email)s,
              %(phone_number)s,
              %(date_of_birth)s,
              %(role)s,
              %(preferred)s
            )
            RETURNING id::text AS id
            """,
            {"company_id": company_id, **input_data.model_dump()},
        ).fetchone()

    return {"contact": contact}


@app.patch("/api/companies/{company_id}/contacts/{contact_id}")
def update_contact(company_id: CompanyId, contact_id: ContactId, input_data: ContactInput) -> dict[str, object]:
    with db_connect() as conn:
        contact = conn.execute(
            """
            UPDATE companies.company_persons
            SET
              name = %(name)s,
              email = %(email)s,
              phone_number = %(phone_number)s,
              date_of_birth = %(date_of_birth)s,
              role = %(role)s,
              preferred = %(preferred)s
            WHERE company_id = %(company_id)s
              AND id = %(contact_id)s
            RETURNING id::text AS id
            """,
            {"company_id": company_id, "contact_id": contact_id, **input_data.model_dump()},
        ).fetchone()

        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")

    return {"contact": contact}


@app.delete("/api/companies/{company_id}/contacts/{contact_id}")
def delete_contact(company_id: CompanyId, contact_id: ContactId) -> dict[str, bool]:
    with db_connect() as conn:
        result = conn.execute(
            """
            DELETE FROM companies.company_persons
            WHERE company_id = %(company_id)s
              AND id = %(contact_id)s
            RETURNING id
            """,
            {"company_id": company_id, "contact_id": contact_id},
        ).fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Contact not found")

    return {"success": True}


@app.post("/api/companies/{company_id}/bank-accounts", status_code=status.HTTP_201_CREATED)
def create_bank_account(company_id: CompanyId, input_data: BankAccountInput) -> dict[str, object]:
    with db_connect() as conn:
        company = conn.execute(
            "SELECT id FROM companies.companies WHERE id = %(company_id)s",
            {"company_id": company_id},
        ).fetchone()

        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        bank_account = conn.execute(
            """
            INSERT INTO companies.company_bank_accounts (
              company_id,
              bank_account_number,
              bank_code,
              preferred
            )
            VALUES (%(company_id)s, %(bank_account_number)s, %(bank_code)s, %(preferred)s)
            RETURNING id::text AS id
            """,
            {"company_id": company_id, **input_data.model_dump()},
        ).fetchone()

    return {"bankAccount": bank_account}


@app.patch("/api/companies/{company_id}/bank-accounts/{bank_account_id}")
def update_bank_account(
    company_id: CompanyId,
    bank_account_id: BankAccountId,
    input_data: BankAccountInput,
) -> dict[str, object]:
    with db_connect() as conn:
        bank_account = conn.execute(
            """
            UPDATE companies.company_bank_accounts
            SET
              bank_account_number = %(bank_account_number)s,
              bank_code = %(bank_code)s,
              preferred = %(preferred)s
            WHERE company_id = %(company_id)s
              AND id = %(bank_account_id)s
            RETURNING id::text AS id
            """,
            {"company_id": company_id, "bank_account_id": bank_account_id, **input_data.model_dump()},
        ).fetchone()

        if not bank_account:
            raise HTTPException(status_code=404, detail="Bank account not found")

    return {"bankAccount": bank_account}


@app.delete("/api/companies/{company_id}/bank-accounts/{bank_account_id}")
def delete_bank_account(company_id: CompanyId, bank_account_id: BankAccountId) -> dict[str, bool]:
    with db_connect() as conn:
        try:
            result = conn.execute(
                """
                DELETE FROM companies.company_bank_accounts
                WHERE company_id = %(company_id)s
                  AND id = %(bank_account_id)s
                RETURNING id
                """,
                {"company_id": company_id, "bank_account_id": bank_account_id},
            ).fetchone()
        except psycopg.errors.ForeignKeyViolation as error:
            raise HTTPException(
                status_code=409,
                detail="Bank account is used in tenders and cannot be deleted",
            ) from error

        if not result:
            raise HTTPException(status_code=404, detail="Bank account not found")

    return {"success": True}
