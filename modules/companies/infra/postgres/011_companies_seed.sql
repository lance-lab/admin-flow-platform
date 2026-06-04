INSERT INTO platform.permissions (code, description)
VALUES
  ('companies.read', 'Read companies module data'),
  ('companies.create', 'Create companies'),
  ('companies.update', 'Update companies'),
  ('companies.delete', 'Delete companies'),
  ('companies.verify', 'Verify companies through registry APIs')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.code = 'platform_admin' AND p.code LIKE 'companies.%'
ON CONFLICT DO NOTHING;

INSERT INTO platform.modules (code, name, description, route_path, backend_base_url, required_permission, enabled)
VALUES (
  'companies',
  'Companies',
  'Shared company, contact, and bank account management.',
  '/modules/companies',
  'http://companies-api:8000',
  'companies.read',
  TRUE
)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  route_path = EXCLUDED.route_path,
  backend_base_url = EXCLUDED.backend_base_url,
  required_permission = EXCLUDED.required_permission,
  enabled = EXCLUDED.enabled;

INSERT INTO platform.module_translations (module_code, locale, name, description)
VALUES
  (
    'companies',
    'en',
    'Companies',
    'Shared company, contact, and bank account management.'
  ),
  (
    'companies',
    'sk',
    'Spoločnosti',
    'Zdieľaná správa spoločností, kontaktov a bankových účtov.'
  )
ON CONFLICT (module_code, locale) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
