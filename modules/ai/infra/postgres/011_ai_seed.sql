INSERT INTO platform.permissions (code, description)
VALUES
  ('ai.read', 'Read and use AI assistance')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
JOIN platform.permissions p ON p.code = 'ai.read'
WHERE r.code IN ('admin', 'platform_admin')
ON CONFLICT DO NOTHING;

INSERT INTO platform.modules (code, name, description, route_path, backend_base_url, required_permission, enabled)
VALUES (
  'ai',
  'AI Assistant',
  'Local AI prompt testing and model run history.',
  '/modules/ai',
  'http://ai-api:8000',
  'ai.read',
  TRUE
)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  route_path = EXCLUDED.route_path,
  backend_base_url = EXCLUDED.backend_base_url,
  required_permission = EXCLUDED.required_permission,
  enabled = EXCLUDED.enabled,
  updated_at = now();

INSERT INTO platform.module_translations (module_code, locale, name, description)
VALUES
  ('ai', 'sk', 'AI asistent', 'Lokálne AI testovanie promptov a história behov modelu.'),
  ('ai', 'en', 'AI Assistant', 'Local AI prompt testing and model run history.')
ON CONFLICT (module_code, locale) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
