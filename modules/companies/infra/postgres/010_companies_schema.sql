CREATE SCHEMA IF NOT EXISTS companies;

CREATE TABLE IF NOT EXISTS companies.persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ico TEXT,
  dic TEXT,
  ic_dph TEXT,
  address_street TEXT,
  address_number TEXT,
  address_city TEXT,
  address_country TEXT NOT NULL DEFAULT 'SK',
  address_postal_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT companies_ico_unique UNIQUE (ico)
);

CREATE TABLE IF NOT EXISTS companies.company_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies.companies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES companies.persons(id) ON DELETE CASCADE,
  role TEXT,
  preferred BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_persons_company_person_unique UNIQUE (company_id, person_id)
);

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
CREATE INDEX IF NOT EXISTS companies_persons_email_idx ON companies.persons (email);
CREATE INDEX IF NOT EXISTS company_persons_company_id_idx ON companies.company_persons (company_id);
CREATE INDEX IF NOT EXISTS company_persons_person_id_idx ON companies.company_persons (person_id);
CREATE INDEX IF NOT EXISTS company_bank_accounts_company_id_idx ON companies.company_bank_accounts (company_id);
