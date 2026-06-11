from typing import Literal

import psycopg
from fastapi import FastAPI, HTTPException, status
from psycopg.rows import dict_row
from pydantic import BaseModel, ConfigDict, Field

from .config import settings

app = FastAPI(title="Tenders Module API", version="0.1.0")


def db_connect():
    return psycopg.connect(settings.database_url, row_factory=dict_row)


TenderType = Literal["survey", "competition"]
ProcurementType = Literal["goods", "services", "works"]
ProcurementItemUnit = Literal["pcs", "m", "kg"]


class ProcurementContractInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tender_type: TenderType = Field(alias="tenderType")
    josephine_external_id: str | None = Field(default=None, alias="josephineExternalId", max_length=20)
    contracting_authority_company_id: str | None = Field(default=None, alias="contractingAuthorityCompanyId")
    contracting_authority_contact_person_id: str | None = Field(
        default=None,
        alias="contractingAuthorityContactPersonId",
    )
    contracting_authority_bank_account_id: str | None = Field(
        default=None,
        alias="contractingAuthorityBankAccountId",
    )
    supplier_company_id: str | None = Field(default=None, alias="supplierCompanyId")
    supplier_contact_person_id: str | None = Field(default=None, alias="supplierContactPersonId")
    supplier_bank_account_id: str | None = Field(default=None, alias="supplierBankAccountId")
    measure_number: str | None = Field(default=None, alias="measureNumber")
    measure_sub_number: str | None = Field(default=None, alias="measureSubNumber")
    call_number: str | None = Field(default=None, alias="callNumber")
    procurement_type: ProcurementType | None = Field(default=None, alias="procurementType")
    name: str = Field(min_length=1)
    lot_division: str | None = Field(default=None, alias="lotDivision")
    project_name: str | None = Field(default=None, alias="projectName")
    project_code: str | None = Field(default=None, alias="projectCode")
    cpv_code: str | None = Field(default=None, alias="cpvCode")
    contract_type: str | None = Field(default=None, alias="contractType")
    delivery_address_street_number: str | None = Field(default=None, alias="deliveryAddressStreetNumber")
    delivery_address_postal_code: str | None = Field(default=None, alias="deliveryAddressPostalCode")
    delivery_address_city: str | None = Field(default=None, alias="deliveryAddressCity")
    estimated_value_excl_vat: float | None = Field(default=None, alias="estimatedValueExclVat")
    estimated_value_incl_vat: float | None = Field(default=None, alias="estimatedValueInclVat")


class ProcurementItemInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1)
    description: str | None = None
    quantity: float | None = None
    unit: ProcurementItemUnit | None = None
    estimated_value_excl_vat: float | None = Field(default=None, alias="estimatedValueExclVat")
    estimated_value_incl_vat: float | None = Field(default=None, alias="estimatedValueInclVat")


class ProcurementContractWithItemsInput(ProcurementContractInput):
    items: list[ProcurementItemInput] = Field(default_factory=list)


@app.on_event("startup")
def apply_compatibility_migrations() -> None:
    with db_connect() as conn:
        conn.execute(
            """
            ALTER TABLE tenders.tenders
              ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
            """
        )
        conn.execute(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM pg_type
                WHERE typnamespace = 'tenders'::regnamespace
                  AND typname = 'procurement_item_unit'
              ) THEN
                CREATE TYPE tenders.procurement_item_unit AS ENUM ('pcs', 'm', 'kg');
              END IF;
            END $$;
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tenders.procurement_items (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              procurement_contract_id UUID NOT NULL REFERENCES tenders.procurement_contracts(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              description TEXT,
              quantity NUMERIC(10, 2),
              unit tenders.procurement_item_unit,
              estimated_value_excl_vat NUMERIC(10, 2),
              estimated_value_incl_vat NUMERIC(10, 2),
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS tenders_procurement_items_contract_id_idx
            ON tenders.procurement_items (procurement_contract_id);
            """
        )
        conn.execute(
            """
            ALTER TABLE tenders.tender_companies
              ADD COLUMN IF NOT EXISTS contact_person_id UUID,
              ADD COLUMN IF NOT EXISTS bank_account_id UUID;
            """
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "tenders-api"}


@app.get("/api/overview")
def overview() -> dict[str, object]:
    return {
        "module": "tenders",
        "status": "Ready",
        "capabilities": [
            "Tender records",
            "Measures",
            "Procurement contracts",
            "Procurement items",
            "Contract list and creation",
        ],
    }


def assert_contracting_authority_company(conn: psycopg.Connection, company_id: str | None) -> None:
    if not company_id:
        return

    company = conn.execute(
        """
        SELECT id
        FROM companies.companies
        WHERE id = %(company_id)s
          AND contracting_authority = TRUE
        """,
        {"company_id": company_id},
    ).fetchone()

    if not company:
        raise HTTPException(status_code=400, detail="Contracting authority company not found")


def assert_company(conn: psycopg.Connection, company_id: str | None) -> None:
    if not company_id:
        return

    company = conn.execute(
        """
        SELECT id
        FROM companies.companies
        WHERE id = %(company_id)s
        """,
        {"company_id": company_id},
    ).fetchone()

    if not company:
        raise HTTPException(status_code=400, detail="Company not found")


def assert_company_contact_person(conn: psycopg.Connection, company_id: str | None, contact_person_id: str | None) -> None:
    if not contact_person_id:
        return

    if not company_id:
        raise HTTPException(status_code=400, detail="Contact person requires a selected company")

    contact_person = conn.execute(
        """
        SELECT id
        FROM companies.company_persons
        WHERE id = %(contact_person_id)s
          AND company_id = %(company_id)s
        """,
        {"company_id": company_id, "contact_person_id": contact_person_id},
    ).fetchone()

    if not contact_person:
        raise HTTPException(status_code=400, detail="Contact person does not belong to selected company")


def assert_company_bank_account(conn: psycopg.Connection, company_id: str | None, bank_account_id: str | None) -> None:
    if not bank_account_id:
        return

    if not company_id:
        raise HTTPException(status_code=400, detail="Bank account requires a selected company")

    bank_account = conn.execute(
        """
        SELECT id
        FROM companies.company_bank_accounts
        WHERE id = %(bank_account_id)s
          AND company_id = %(company_id)s
        """,
        {"company_id": company_id, "bank_account_id": bank_account_id},
    ).fetchone()

    if not bank_account:
        raise HTTPException(status_code=400, detail="Bank account does not belong to selected company")


def assert_contracting_authority_association(
    conn: psycopg.Connection,
    company_id: str | None,
    contact_person_id: str | None,
    bank_account_id: str | None,
) -> None:
    assert_contracting_authority_company(conn, company_id)
    assert_company_contact_person(conn, company_id, contact_person_id)
    assert_company_bank_account(conn, company_id, bank_account_id)


def assert_company_association(
    conn: psycopg.Connection,
    company_id: str | None,
    contact_person_id: str | None,
    bank_account_id: str | None,
) -> None:
    assert_company(conn, company_id)
    assert_company_contact_person(conn, company_id, contact_person_id)
    assert_company_bank_account(conn, company_id, bank_account_id)


def save_tender_company(
    conn: psycopg.Connection,
    tender_id: str,
    role: str,
    company_id: str | None,
    contact_person_id: str | None,
    bank_account_id: str | None,
) -> None:
    conn.execute(
        """
        DELETE FROM tenders.tender_companies
        WHERE tender_id = %(tender_id)s
          AND role = %(role)s::tenders.tender_company_role
        """,
        {"tender_id": tender_id, "role": role},
    )

    if not company_id:
        return

    conn.execute(
        """
        INSERT INTO tenders.tender_companies (
          tender_id,
          company_id,
          role,
          contact_person_id,
          bank_account_id,
          is_primary
        )
        VALUES (
          %(tender_id)s,
          %(company_id)s,
          %(role)s::tenders.tender_company_role,
          %(contact_person_id)s,
          %(bank_account_id)s,
          TRUE
        )
        """,
        {
            "tender_id": tender_id,
            "role": role,
            "company_id": company_id,
            "contact_person_id": contact_person_id,
            "bank_account_id": bank_account_id,
        },
    )


def save_contracting_authority_company(
    conn: psycopg.Connection,
    tender_id: str,
    company_id: str | None,
    contact_person_id: str | None,
    bank_account_id: str | None,
) -> None:
    save_tender_company(
        conn,
        tender_id,
        "contracting_authority",
        company_id,
        contact_person_id,
        bank_account_id,
    )


@app.get("/api/procurement-contracts")
def list_procurement_contracts() -> dict[str, object]:
    with db_connect() as conn:
        rows = conn.execute(
            """
            SELECT
              pc.id::text AS id,
              pc.tender_id::text AS "tenderId",
              t.type AS "tenderType",
              t.josephine_external_id AS "josephineExternalId",
              ca.id AS "contractingAuthorityCompanyId",
              ca.name AS "contractingAuthorityCompanyName",
              ca.ico AS "contractingAuthorityCompanyIco",
              ca.dic AS "contractingAuthorityCompanyDic",
              ca.ic_dph AS "contractingAuthorityCompanyIcDph",
              ca.address_street AS "contractingAuthorityCompanyAddressStreet",
              ca.address_number AS "contractingAuthorityCompanyAddressNumber",
              ca.address_city AS "contractingAuthorityCompanyAddressCity",
              ca.address_country AS "contractingAuthorityCompanyAddressCountry",
              ca.address_postal_code AS "contractingAuthorityCompanyAddressPostalCode",
              ca.contracting_authority AS "contractingAuthorityCompanyContractingAuthority",
              ca.contact_person_id AS "contractingAuthorityContactPersonId",
              ca.contact_person_name AS "contractingAuthorityContactPersonName",
              ca.contact_person_email AS "contractingAuthorityContactPersonEmail",
              ca.contact_person_phone_number AS "contractingAuthorityContactPersonPhoneNumber",
              ca.contact_person_date_of_birth AS "contractingAuthorityContactPersonDateOfBirth",
              ca.contact_person_role AS "contractingAuthorityContactPersonRole",
              ca.bank_account_id AS "contractingAuthorityBankAccountId",
              ca.bank_account_number AS "contractingAuthorityBankAccountNumber",
              ca.bank_code AS "contractingAuthorityBankCode",
              supplier.id AS "supplierCompanyId",
              supplier.name AS "supplierCompanyName",
              supplier.ico AS "supplierCompanyIco",
              supplier.dic AS "supplierCompanyDic",
              supplier.ic_dph AS "supplierCompanyIcDph",
              supplier.address_street AS "supplierCompanyAddressStreet",
              supplier.address_number AS "supplierCompanyAddressNumber",
              supplier.address_city AS "supplierCompanyAddressCity",
              supplier.address_country AS "supplierCompanyAddressCountry",
              supplier.address_postal_code AS "supplierCompanyAddressPostalCode",
              supplier.contracting_authority AS "supplierCompanyContractingAuthority",
              supplier.contact_person_id AS "supplierContactPersonId",
              supplier.contact_person_name AS "supplierContactPersonName",
              supplier.contact_person_email AS "supplierContactPersonEmail",
              supplier.contact_person_phone_number AS "supplierContactPersonPhoneNumber",
              supplier.contact_person_date_of_birth AS "supplierContactPersonDateOfBirth",
              supplier.contact_person_role AS "supplierContactPersonRole",
              supplier.bank_account_id AS "supplierBankAccountId",
              supplier.bank_account_number AS "supplierBankAccountNumber",
              supplier.bank_code AS "supplierBankCode",
              m.id::text AS "measureId",
              m.number AS "measureNumber",
              m.sub_number AS "measureSubNumber",
              m.call_number AS "callNumber",
              m.procurement_type AS "procurementType",
              pc.name,
              pc.lot_division AS "lotDivision",
              pc.project_name AS "projectName",
              pc.project_code AS "projectCode",
              pc.cpv_code AS "cpvCode",
              pc.contract_type AS "contractType",
              pc.delivery_address_street_number AS "deliveryAddressStreetNumber",
              pc.delivery_address_postal_code AS "deliveryAddressPostalCode",
              pc.delivery_address_city AS "deliveryAddressCity",
              pc.estimated_value_excl_vat::float AS "estimatedValueExclVat",
              pc.estimated_value_incl_vat::float AS "estimatedValueInclVat",
              COALESCE(items.items, '[]'::jsonb) AS items
            FROM tenders.procurement_contracts pc
            JOIN tenders.tenders t ON t.id = pc.tender_id
            LEFT JOIN LATERAL (
              SELECT
                c.id::text AS id,
                c.name,
                c.ico,
                c.dic,
                c.ic_dph,
                c.address_street,
                c.address_number,
                c.address_city,
                c.address_country,
                c.address_postal_code,
                c.contracting_authority,
                cp.id::text AS contact_person_id,
                cp.name AS contact_person_name,
                cp.email AS contact_person_email,
                cp.phone_number AS contact_person_phone_number,
                cp.date_of_birth::text AS contact_person_date_of_birth,
                cp.role AS contact_person_role,
                cba.id::text AS bank_account_id,
                cba.bank_account_number,
                cba.bank_code
              FROM tenders.tender_companies tc
              JOIN companies.companies c ON c.id = tc.company_id
              LEFT JOIN companies.company_persons cp ON cp.id = tc.contact_person_id
              LEFT JOIN companies.company_bank_accounts cba ON cba.id = tc.bank_account_id
              WHERE tc.tender_id = pc.tender_id
                AND tc.role = 'contracting_authority'::tenders.tender_company_role
              ORDER BY tc.is_primary DESC, tc.created_at ASC
              LIMIT 1
            ) ca ON TRUE
            LEFT JOIN LATERAL (
              SELECT
                c.id::text AS id,
                c.name,
                c.ico,
                c.dic,
                c.ic_dph,
                c.address_street,
                c.address_number,
                c.address_city,
                c.address_country,
                c.address_postal_code,
                c.contracting_authority,
                cp.id::text AS contact_person_id,
                cp.name AS contact_person_name,
                cp.email AS contact_person_email,
                cp.phone_number AS contact_person_phone_number,
                cp.date_of_birth::text AS contact_person_date_of_birth,
                cp.role AS contact_person_role,
                cba.id::text AS bank_account_id,
                cba.bank_account_number,
                cba.bank_code
              FROM tenders.tender_companies tc
              JOIN companies.companies c ON c.id = tc.company_id
              LEFT JOIN companies.company_persons cp ON cp.id = tc.contact_person_id
              LEFT JOIN companies.company_bank_accounts cba ON cba.id = tc.bank_account_id
              WHERE tc.tender_id = pc.tender_id
                AND tc.role = 'supplier'::tenders.tender_company_role
              ORDER BY tc.is_primary DESC, tc.created_at ASC
              LIMIT 1
            ) supplier ON TRUE
            LEFT JOIN LATERAL (
              SELECT *
              FROM tenders.measures
              WHERE tender_id = pc.tender_id
              ORDER BY created_at ASC
              LIMIT 1
            ) m ON TRUE
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', pi.id::text,
                  'procurementContractId', pi.procurement_contract_id::text,
                  'name', pi.name,
                  'description', pi.description,
                  'quantity', pi.quantity::float,
                  'unit', pi.unit,
                  'estimatedValueExclVat', pi.estimated_value_excl_vat::float,
                  'estimatedValueInclVat', pi.estimated_value_incl_vat::float
                )
                ORDER BY pi.created_at ASC, pi.name ASC
              ) AS items
              FROM tenders.procurement_items pi
              WHERE pi.procurement_contract_id = pc.id
            ) items ON TRUE
            ORDER BY pc.created_at DESC, pc.name ASC
            """
        ).fetchall()

    return {"procurementContracts": rows}


@app.get("/api/contracting-authority-companies")
def list_contracting_authority_companies() -> dict[str, object]:
    with db_connect() as conn:
        rows = conn.execute(
            """
            SELECT
              id::text AS id,
              name,
              ico
            FROM companies.companies
            WHERE contracting_authority = TRUE
            ORDER BY name ASC
            """
        ).fetchall()

    return {"companies": rows}


@app.get("/api/contracting-authority-companies/{company_id}")
def get_contracting_authority_company(company_id: str) -> dict[str, object]:
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
              AND contracting_authority = TRUE
            """,
            {"company_id": company_id},
        ).fetchone()

        if not company:
            raise HTTPException(status_code=404, detail="Contracting authority company not found")

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


@app.get("/api/companies")
def list_companies() -> dict[str, object]:
    with db_connect() as conn:
        rows = conn.execute(
            """
            SELECT
              id::text AS id,
              name,
              ico
            FROM companies.companies
            ORDER BY name ASC
            """
        ).fetchall()

    return {"companies": rows}


@app.get("/api/companies/{company_id}")
def get_company(company_id: str) -> dict[str, object]:
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


@app.post("/api/procurement-contracts", status_code=status.HTTP_201_CREATED)
def create_procurement_contract(input_data: ProcurementContractWithItemsInput) -> dict[str, object]:
    data = input_data.model_dump()
    items = data.pop("items")
    contracting_authority_company_id = data.pop("contracting_authority_company_id")
    contracting_authority_contact_person_id = data.pop("contracting_authority_contact_person_id")
    contracting_authority_bank_account_id = data.pop("contracting_authority_bank_account_id")
    supplier_company_id = data.pop("supplier_company_id")
    supplier_contact_person_id = data.pop("supplier_contact_person_id")
    supplier_bank_account_id = data.pop("supplier_bank_account_id")

    with db_connect() as conn:
        assert_contracting_authority_association(
            conn,
            contracting_authority_company_id,
            contracting_authority_contact_person_id,
            contracting_authority_bank_account_id,
        )
        assert_company_association(
            conn,
            supplier_company_id,
            supplier_contact_person_id,
            supplier_bank_account_id,
        )

        try:
            tender = conn.execute(
                """
                INSERT INTO tenders.tenders (
                  title,
                  type,
                  josephine_external_id
                )
                VALUES (
                  %(name)s,
                  %(tender_type)s::tenders.tender_type,
                  %(josephine_external_id)s
                )
                RETURNING id
                """,
                data,
            ).fetchone()
        except psycopg.errors.UniqueViolation as error:
            raise HTTPException(status_code=409, detail="Tender Josephine external ID already exists") from error

        tender_id = tender["id"]
        save_contracting_authority_company(
            conn,
            tender_id,
            contracting_authority_company_id,
            contracting_authority_contact_person_id,
            contracting_authority_bank_account_id,
        )
        save_tender_company(
            conn,
            tender_id,
            "supplier",
            supplier_company_id,
            supplier_contact_person_id,
            supplier_bank_account_id,
        )

        has_measure = any(
            data.get(field)
            for field in ("measure_number", "measure_sub_number", "call_number", "procurement_type")
        )

        if has_measure:
            conn.execute(
                """
                INSERT INTO tenders.measures (
                  tender_id,
                  number,
                  sub_number,
                  call_number,
                  procurement_type
                )
                VALUES (
                  %(tender_id)s,
                  %(measure_number)s,
                  %(measure_sub_number)s,
                  %(call_number)s,
                  %(procurement_type)s::tenders.procurement_type
                )
                """,
                {"tender_id": tender_id, **data},
            )

        procurement_contract = conn.execute(
            """
            INSERT INTO tenders.procurement_contracts (
              tender_id,
              name,
              lot_division,
              project_name,
              project_code,
              cpv_code,
              contract_type,
              delivery_address_street_number,
              delivery_address_postal_code,
              delivery_address_city,
              estimated_value_excl_vat,
              estimated_value_incl_vat
            )
            VALUES (
              %(tender_id)s,
              %(name)s,
              %(lot_division)s,
              %(project_name)s,
              %(project_code)s,
              %(cpv_code)s,
              %(contract_type)s,
              %(delivery_address_street_number)s,
              %(delivery_address_postal_code)s,
              %(delivery_address_city)s,
              %(estimated_value_excl_vat)s,
              %(estimated_value_incl_vat)s
            )
            RETURNING id::text AS id
            """,
            {"tender_id": tender_id, **data},
        ).fetchone()

        for item in items:
            conn.execute(
                """
                INSERT INTO tenders.procurement_items (
                  procurement_contract_id,
                  name,
                  description,
                  quantity,
                  unit,
                  estimated_value_excl_vat,
                  estimated_value_incl_vat
                )
                VALUES (
                  %(procurement_contract_id)s,
                  %(name)s,
                  %(description)s,
                  %(quantity)s,
                  %(unit)s::tenders.procurement_item_unit,
                  %(estimated_value_excl_vat)s,
                  %(estimated_value_incl_vat)s
                )
                """,
                {"procurement_contract_id": procurement_contract["id"], **item},
            )

    return {"procurementContract": procurement_contract}


@app.patch("/api/procurement-contracts/{procurement_contract_id}")
def update_procurement_contract(
    procurement_contract_id: str,
    input_data: ProcurementContractWithItemsInput,
) -> dict[str, object]:
    data = input_data.model_dump()
    items = data.pop("items")
    contracting_authority_company_id = data.pop("contracting_authority_company_id")
    contracting_authority_contact_person_id = data.pop("contracting_authority_contact_person_id")
    contracting_authority_bank_account_id = data.pop("contracting_authority_bank_account_id")
    supplier_company_id = data.pop("supplier_company_id")
    supplier_contact_person_id = data.pop("supplier_contact_person_id")
    supplier_bank_account_id = data.pop("supplier_bank_account_id")

    with db_connect() as conn:
        assert_contracting_authority_association(
            conn,
            contracting_authority_company_id,
            contracting_authority_contact_person_id,
            contracting_authority_bank_account_id,
        )
        assert_company_association(
            conn,
            supplier_company_id,
            supplier_contact_person_id,
            supplier_bank_account_id,
        )

        procurement_contract = conn.execute(
            """
            SELECT pc.id, pc.tender_id
            FROM tenders.procurement_contracts pc
            WHERE pc.id = %(procurement_contract_id)s
            """,
            {"procurement_contract_id": procurement_contract_id},
        ).fetchone()

        if not procurement_contract:
            raise HTTPException(status_code=404, detail="Procurement contract not found")

        tender_id = procurement_contract["tender_id"]
        save_contracting_authority_company(
            conn,
            tender_id,
            contracting_authority_company_id,
            contracting_authority_contact_person_id,
            contracting_authority_bank_account_id,
        )
        save_tender_company(
            conn,
            tender_id,
            "supplier",
            supplier_company_id,
            supplier_contact_person_id,
            supplier_bank_account_id,
        )

        try:
            conn.execute(
                """
                UPDATE tenders.tenders
                SET
                  title = %(name)s,
                  type = %(tender_type)s::tenders.tender_type,
                  josephine_external_id = %(josephine_external_id)s
                WHERE id = %(tender_id)s
                """,
                {"tender_id": tender_id, **data},
            )
        except psycopg.errors.UniqueViolation as error:
            raise HTTPException(status_code=409, detail="Tender Josephine external ID already exists") from error

        has_measure = any(
            data.get(field)
            for field in ("measure_number", "measure_sub_number", "call_number", "procurement_type")
        )

        if has_measure:
            existing_measure = conn.execute(
                """
                SELECT id
                FROM tenders.measures
                WHERE tender_id = %(tender_id)s
                ORDER BY created_at ASC
                LIMIT 1
                """,
                {"tender_id": tender_id},
            ).fetchone()

            if existing_measure:
                conn.execute(
                    """
                    UPDATE tenders.measures
                    SET
                      number = %(measure_number)s,
                      sub_number = %(measure_sub_number)s,
                      call_number = %(call_number)s,
                      procurement_type = %(procurement_type)s::tenders.procurement_type
                    WHERE id = %(measure_id)s
                    """,
                    {"measure_id": existing_measure["id"], **data},
                )
            else:
                conn.execute(
                    """
                    INSERT INTO tenders.measures (
                      tender_id,
                      number,
                      sub_number,
                      call_number,
                      procurement_type
                    )
                    VALUES (
                      %(tender_id)s,
                      %(measure_number)s,
                      %(measure_sub_number)s,
                      %(call_number)s,
                      %(procurement_type)s::tenders.procurement_type
                    )
                    """,
                    {"tender_id": tender_id, **data},
                )
        else:
            conn.execute(
                "DELETE FROM tenders.measures WHERE tender_id = %(tender_id)s",
                {"tender_id": tender_id},
            )

        updated_contract = conn.execute(
            """
            UPDATE tenders.procurement_contracts
            SET
              name = %(name)s,
              lot_division = %(lot_division)s,
              project_name = %(project_name)s,
              project_code = %(project_code)s,
              cpv_code = %(cpv_code)s,
              contract_type = %(contract_type)s,
              delivery_address_street_number = %(delivery_address_street_number)s,
              delivery_address_postal_code = %(delivery_address_postal_code)s,
              delivery_address_city = %(delivery_address_city)s,
              estimated_value_excl_vat = %(estimated_value_excl_vat)s,
              estimated_value_incl_vat = %(estimated_value_incl_vat)s
            WHERE id = %(procurement_contract_id)s
            RETURNING id::text AS id
            """,
            {"procurement_contract_id": procurement_contract_id, **data},
        ).fetchone()

        conn.execute(
            """
            DELETE FROM tenders.procurement_items
            WHERE procurement_contract_id = %(procurement_contract_id)s
            """,
            {"procurement_contract_id": procurement_contract_id},
        )

        for item in items:
            conn.execute(
                """
                INSERT INTO tenders.procurement_items (
                  procurement_contract_id,
                  name,
                  description,
                  quantity,
                  unit,
                  estimated_value_excl_vat,
                  estimated_value_incl_vat
                )
                VALUES (
                  %(procurement_contract_id)s,
                  %(name)s,
                  %(description)s,
                  %(quantity)s,
                  %(unit)s::tenders.procurement_item_unit,
                  %(estimated_value_excl_vat)s,
                  %(estimated_value_incl_vat)s
                )
                """,
                {"procurement_contract_id": procurement_contract_id, **item},
            )

    return {"procurementContract": updated_contract}


@app.post("/api/procurement-contracts/{procurement_contract_id}/items", status_code=status.HTTP_201_CREATED)
def create_procurement_item(procurement_contract_id: str, input_data: ProcurementItemInput) -> dict[str, object]:
    data = input_data.model_dump()

    with db_connect() as conn:
        procurement_contract = conn.execute(
            """
            SELECT id
            FROM tenders.procurement_contracts
            WHERE id = %(procurement_contract_id)s
            """,
            {"procurement_contract_id": procurement_contract_id},
        ).fetchone()

        if not procurement_contract:
            raise HTTPException(status_code=404, detail="Procurement contract not found")

        procurement_item = conn.execute(
            """
            INSERT INTO tenders.procurement_items (
              procurement_contract_id,
              name,
              description,
              quantity,
              unit,
              estimated_value_excl_vat,
              estimated_value_incl_vat
            )
            VALUES (
              %(procurement_contract_id)s,
              %(name)s,
              %(description)s,
              %(quantity)s,
              %(unit)s::tenders.procurement_item_unit,
              %(estimated_value_excl_vat)s,
              %(estimated_value_incl_vat)s
            )
            RETURNING
              id::text AS id,
              procurement_contract_id::text AS "procurementContractId",
              name,
              description,
              quantity::float,
              unit,
              estimated_value_excl_vat::float AS "estimatedValueExclVat",
              estimated_value_incl_vat::float AS "estimatedValueInclVat"
            """,
            {"procurement_contract_id": procurement_contract_id, **data},
        ).fetchone()

    return {"procurementItem": procurement_item}
