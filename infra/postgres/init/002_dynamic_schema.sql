CREATE SCHEMA IF NOT EXISTS dynamic;

CREATE TABLE IF NOT EXISTS dynamic.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES platform.modules(code),
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  protected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_code, name)
);

CREATE TABLE IF NOT EXISTS dynamic.columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES dynamic.tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  unique_value BOOLEAN NOT NULL DEFAULT FALSE,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  UNIQUE (table_id, name)
);

CREATE TABLE IF NOT EXISTS dynamic.rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES dynamic.tables(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
