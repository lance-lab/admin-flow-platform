CREATE SCHEMA IF NOT EXISTS tenders;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'tenders'::regnamespace AND typname = 'tender_type') THEN
    CREATE TYPE tenders.tender_type AS ENUM ('survey', 'competition');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'tenders'::regnamespace AND typname = 'procurement_type') THEN
    CREATE TYPE tenders.procurement_type AS ENUM ('goods', 'services', 'works');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'tenders'::regnamespace AND typname = 'tender_company_role') THEN
    CREATE TYPE tenders.tender_company_role AS ENUM ('contracting_authority', 'bidder', 'winner', 'supplier');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tenders.tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type tenders.tender_type NOT NULL,
  josephine_external_id VARCHAR(20),
  created_by UUID REFERENCES platform.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenders_josephine_external_id_unique UNIQUE (josephine_external_id)
);

ALTER TABLE tenders.tenders
  ADD COLUMN IF NOT EXISTS type tenders.tender_type NOT NULL DEFAULT 'survey',
  ADD COLUMN IF NOT EXISTS josephine_external_id VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenders_josephine_external_id_unique'
      AND conrelid = 'tenders.tenders'::regclass
  ) THEN
    ALTER TABLE tenders.tenders
      ADD CONSTRAINT tenders_josephine_external_id_unique UNIQUE (josephine_external_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tenders.measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES tenders.tenders(id) ON DELETE CASCADE,
  number TEXT,
  sub_number TEXT,
  call_number TEXT,
  procurement_type tenders.procurement_type,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenders.procurement_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES tenders.tenders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lot_division TEXT,
  project_name TEXT,
  project_code TEXT,
  cpv_code TEXT,
  contract_type TEXT,
  responsible_contact_id UUID REFERENCES companies.company_persons(id) ON DELETE SET NULL,
  delivery_address_street_number TEXT,
  delivery_address_postal_code TEXT,
  delivery_address_city TEXT,
  offer_submission_deadline TIMESTAMPTZ,
  offer_opening_at TIMESTAMPTZ,
  call_signed_at TIMESTAMPTZ,
  record_signed_at TIMESTAMPTZ,
  mandate_signed_at TIMESTAMPTZ,
  document_date TIMESTAMPTZ,
  delivery_deadline TIMESTAMPTZ,
  offer_validity_deadline TIMESTAMPTZ,
  estimated_value_excl_vat NUMERIC(10, 2),
  estimated_value_incl_vat NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenders.tender_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES tenders.tenders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies.companies(id) ON DELETE CASCADE,
  role tenders.tender_company_role NOT NULL,
  contact_person_id UUID REFERENCES companies.company_persons(id) ON DELETE SET NULL,
  bank_account_id UUID,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tender_companies_tender_company_role_unique UNIQUE (tender_id, company_id, role),
  CONSTRAINT tender_companies_bank_account_belongs_to_company
    FOREIGN KEY (company_id, bank_account_id)
    REFERENCES companies.company_bank_accounts(company_id, id)
);

ALTER TABLE tenders.procurement_contracts
  ADD COLUMN IF NOT EXISTS responsible_contact_id UUID REFERENCES companies.company_persons(id) ON DELETE SET NULL;

ALTER TABLE tenders.procurement_contracts
  DROP COLUMN IF EXISTS responsible_person_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tender_companies_contact_person_belongs_to_company'
      AND conrelid = 'tenders.tender_companies'::regclass
  ) THEN
    ALTER TABLE tenders.tender_companies
      DROP CONSTRAINT tender_companies_contact_person_belongs_to_company;
  END IF;
END $$;

ALTER TABLE tenders.tender_companies
  ADD COLUMN IF NOT EXISTS contact_person_id UUID;

UPDATE tenders.tender_companies tc
SET contact_person_id = NULL
WHERE contact_person_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM companies.company_persons cp
    WHERE cp.id = tc.contact_person_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tender_companies_contact_person_id_fkey'
      AND conrelid = 'tenders.tender_companies'::regclass
  ) THEN
    ALTER TABLE tenders.tender_companies
      ADD CONSTRAINT tender_companies_contact_person_id_fkey
      FOREIGN KEY (contact_person_id)
      REFERENCES companies.company_persons(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tenders_tenders_type_idx ON tenders.tenders (type);
CREATE INDEX IF NOT EXISTS tenders_measures_tender_id_idx ON tenders.measures (tender_id);
CREATE INDEX IF NOT EXISTS tenders_procurement_contracts_tender_id_idx ON tenders.procurement_contracts (tender_id);
CREATE INDEX IF NOT EXISTS tenders_tender_companies_tender_id_idx ON tenders.tender_companies (tender_id);
CREATE INDEX IF NOT EXISTS tenders_tender_companies_company_id_idx ON tenders.tender_companies (company_id);
CREATE INDEX IF NOT EXISTS tenders_tender_companies_role_idx ON tenders.tender_companies (role);
