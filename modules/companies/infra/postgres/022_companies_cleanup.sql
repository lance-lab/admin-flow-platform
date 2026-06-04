ALTER TABLE companies.company_persons
  DROP COLUMN IF EXISTS person_id;

DROP TABLE IF EXISTS companies.persons;
