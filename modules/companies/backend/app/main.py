from typing import Annotated
from uuid import UUID

import psycopg
from fastapi import FastAPI, HTTPException, Path, status
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from .config import settings

app = FastAPI(title="Companies Module API", version="0.1.0")


def db_connect():
    return psycopg.connect(settings.database_url, row_factory=dict_row)


class CompanyInput(BaseModel):
    name: str = Field(min_length=1)
    ico: str | None = None
    dic: str | None = None
    ic_dph: str | None = None
    address_street: str | None = None
    address_number: str | None = None
    address_city: str | None = None
    address_country: str = "SK"
    address_postal_code: str | None = None


class ContactInput(BaseModel):
    name: str = Field(min_length=1)
    surname: str = Field(min_length=1)
    email: str | None = None
    phone_number: str | None = None
    date_of_birth: str | None = None
    role: str | None = None
    preferred: bool = False


class BankAccountInput(BaseModel):
    bank_account_number: str = Field(min_length=1)
    bank_code: str | None = None
    preferred: bool = False


CompanyId = Annotated[UUID, Path()]


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
                  address_postal_code
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
                  %(address_postal_code)s
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
                  address_postal_code AS "addressPostalCode"
                """,
                input_data.model_dump(),
            ).fetchone()
        except psycopg.errors.UniqueViolation as error:
            raise HTTPException(status_code=409, detail="Company ICO already exists") from error

    return {"company": company}


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
              address_postal_code AS "addressPostalCode"
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
              p.id::text AS "personId",
              p.name,
              p.surname,
              p.email,
              p.phone_number AS "phoneNumber",
              p.date_of_birth::text AS "dateOfBirth",
              cp.role,
              cp.preferred
            FROM companies.company_persons cp
            JOIN companies.persons p ON p.id = cp.person_id
            WHERE cp.company_id = %(company_id)s
            ORDER BY cp.preferred DESC, p.surname ASC, p.name ASC
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

        with conn.transaction():
            person_rows = conn.execute(
                """
                SELECT person_id
                FROM companies.company_persons
                WHERE company_id = %(company_id)s
                """,
                {"company_id": company_id},
            ).fetchall()

            person_ids = [row["person_id"] for row in person_rows]

            conn.execute(
                "DELETE FROM companies.companies WHERE id = %(company_id)s",
                {"company_id": company_id},
            )

            if person_ids:
                conn.execute(
                    """
                    DELETE FROM companies.persons p
                    WHERE p.id = ANY(%(person_ids)s::uuid[])
                      AND NOT EXISTS (
                        SELECT 1
                        FROM companies.company_persons cp
                        WHERE cp.person_id = p.id
                      )
                    """,
                    {"person_ids": person_ids},
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

        with conn.transaction():
            person = conn.execute(
                """
                INSERT INTO companies.persons (name, surname, email, phone_number, date_of_birth)
                VALUES (%(name)s, %(surname)s, %(email)s, %(phone_number)s, %(date_of_birth)s)
                RETURNING id
                """,
                input_data.model_dump(),
            ).fetchone()

            contact = conn.execute(
                """
                INSERT INTO companies.company_persons (company_id, person_id, role, preferred)
                VALUES (%(company_id)s, %(person_id)s, %(role)s, %(preferred)s)
                RETURNING id::text AS id
                """,
                {
                    "company_id": company_id,
                    "person_id": person["id"],
                    "role": input_data.role,
                    "preferred": input_data.preferred,
                },
            ).fetchone()

    return {"contact": contact}


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
