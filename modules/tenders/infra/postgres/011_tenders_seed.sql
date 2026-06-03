INSERT INTO platform.permissions (code, description)
VALUES
  ('tenders.read', 'Read tenders module data'),
  ('tenders.create', 'Create tenders'),
  ('tenders.update', 'Update tenders'),
  ('tenders.delete', 'Delete tenders'),
  ('tenders.evaluate', 'Evaluate tender prices'),
  ('tenders.documents.generate', 'Generate tender documents'),
  ('tenders.organizations.verify', 'Verify organizations through registry APIs'),
  ('tenders.admin.schema.manage', 'Manage Tenders dynamic schema')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.code = 'platform_admin' AND p.code LIKE 'tenders.%'
ON CONFLICT DO NOTHING;

INSERT INTO platform.modules (code, name, description, route_path, backend_base_url, required_permission, enabled)
VALUES (
  'tenders',
  'Tenders',
  'Tender operations, organizations, evaluation, and document generation.',
  '/modules/tenders',
  'http://tenders-api:8000',
  'tenders.read',
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
    'tenders',
    'en',
    'Tenders',
    'Tender operations, organizations, evaluation, and document generation.'
  ),
  (
    'tenders',
    'sk',
    'Zákazky',
    'Správa zákaziek, organizácií, vyhodnocovania a generovania dokumentov.'
  )
ON CONFLICT (module_code, locale) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
