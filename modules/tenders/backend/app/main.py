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


@app.post("/api/procurement-contracts", status_code=status.HTTP_201_CREATED)
def create_procurement_contract(input_data: ProcurementContractWithItemsInput) -> dict[str, object]:
    data = input_data.model_dump()
    items = data.pop("items")

    with db_connect() as conn:
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

    with db_connect() as conn:
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
