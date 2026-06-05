CREATE SCHEMA IF NOT EXISTS companies;

CREATE TABLE IF NOT EXISTS companies.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ico TEXT,
  dic TEXT,
  ic_dph TEXT,
  address_street TEXT,
  address_number TEXT,
  address_city TEXT,
  address_country TEXT NOT NULL DEFAULT 'Slovakia',
  address_postal_code TEXT,
  contracting_authority BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT companies_ico_unique UNIQUE (ico)
);

ALTER TABLE companies.companies
  ADD COLUMN IF NOT EXISTS contracting_authority BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE companies.companies
  ALTER COLUMN address_country SET DEFAULT 'Slovakia';

UPDATE companies.companies
SET address_country = CASE
  WHEN UPPER(address_country) = 'SK' THEN 'Slovakia'
  WHEN UPPER(address_country) = 'CZ' THEN 'Czech Republic'
  ELSE address_country
END
WHERE UPPER(address_country) IN ('SK', 'CZ');

CREATE TABLE IF NOT EXISTS companies.company_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies.companies(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone_number TEXT,
  date_of_birth DATE,
  role TEXT,
  preferred BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE companies.company_persons
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'companies'
      AND table_name = 'company_persons'
      AND column_name = 'person_id'
  ) AND to_regclass('companies.persons') IS NOT NULL THEN
    UPDATE companies.company_persons cp
    SET
      name = NULLIF(TRIM(CONCAT_WS(' ', NULLIF(COALESCE(cp.name, p.name), ''), NULLIF(p.surname, ''))), ''),
      email = COALESCE(cp.email, p.email),
      phone_number = COALESCE(cp.phone_number, p.phone_number),
      date_of_birth = COALESCE(cp.date_of_birth, p.date_of_birth)
    FROM companies.persons p
    WHERE cp.person_id = p.id;
  END IF;
END $$;

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

UPDATE companies.company_persons
SET name = COALESCE(name, '');

ALTER TABLE companies.company_persons
  ALTER COLUMN name SET NOT NULL;

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'companies'
      AND table_name = 'company_persons'
      AND column_name = 'person_id'
  ) THEN
    ALTER TABLE companies.company_persons
      ALTER COLUMN person_id DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('tenders.tender_companies') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tender_companies_contact_person_belongs_to_company'
      AND conrelid = 'tenders.tender_companies'::regclass
  ) THEN
    ALTER TABLE tenders.tender_companies
      DROP CONSTRAINT tender_companies_contact_person_belongs_to_company;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_persons_company_person_unique'
      AND conrelid = 'companies.company_persons'::regclass
  ) THEN
    ALTER TABLE companies.company_persons
      DROP CONSTRAINT company_persons_company_person_unique;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS companies.company_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies.companies(id) ON DELETE CASCADE,
  bank_account_number TEXT NOT NULL,
  bank_code TEXT,
  preferred BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_bank_accounts_company_id_id_unique UNIQUE (company_id, id)
);

CREATE INDEX IF NOT EXISTS companies_companies_name_idx ON companies.companies (name);
CREATE INDEX IF NOT EXISTS companies_companies_ico_idx ON companies.companies (ico);
CREATE INDEX IF NOT EXISTS company_persons_email_idx ON companies.company_persons (email);
CREATE INDEX IF NOT EXISTS company_persons_company_id_idx ON companies.company_persons (company_id);
CREATE INDEX IF NOT EXISTS company_bank_accounts_company_id_idx ON companies.company_bank_accounts (company_id);
