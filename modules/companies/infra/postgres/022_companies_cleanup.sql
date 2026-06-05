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

ALTER TABLE companies.companies
  ALTER COLUMN address_country SET DEFAULT 'Slovakia';

UPDATE companies.companies
SET address_country = CASE
  WHEN UPPER(address_country) = 'SK' THEN 'Slovakia'
  WHEN UPPER(address_country) = 'CZ' THEN 'Czech Republic'
  ELSE address_country
END
WHERE UPPER(address_country) IN ('SK', 'CZ');

ALTER TABLE companies.company_persons
  DROP COLUMN IF EXISTS person_id;

DROP TABLE IF EXISTS companies.persons;
