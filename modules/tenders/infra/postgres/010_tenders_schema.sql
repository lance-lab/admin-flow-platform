CREATE SCHEMA IF NOT EXISTS tenders;

CREATE TABLE IF NOT EXISTS tenders.tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  estimated_value NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  deadline_at TIMESTAMPTZ,
  source_url TEXT,
  created_by UUID REFERENCES platform.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenders.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_number TEXT,
  vat_number TEXT,
  country TEXT NOT NULL DEFAULT 'SK',
  address TEXT,
  registry_status TEXT NOT NULL DEFAULT 'unverified',
  registry_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
