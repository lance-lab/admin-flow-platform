INSERT INTO platform.permissions (code, description)
VALUES
  ('platform.modules.read', 'Read available platform modules'),
  ('platform.modules.manage', 'Manage platform modules'),
  ('platform.users.read', 'Read platform users'),
  ('platform.users.manage', 'Manage platform users')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.roles (code, name)
VALUES
  ('admin', 'Admin'),
  ('platform_admin', 'Platform Admin')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.code = 'platform_admin'
ON CONFLICT DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.code = 'admin'
  AND p.code IN ('platform.modules.read', 'platform.users.read', 'platform.users.manage')
ON CONFLICT DO NOTHING;

INSERT INTO platform.users (email, display_name, password_hash, active)
VALUES (
  'admin@example.com',
  'Platform Admin',
  'pbkdf2_sha256$310000$0ee465a2065ad475767be849abcfb43f$f2defc4b6eead07f0c75662a2ff37f287663a6aea1eaa5489c7f61108d01f822',
  TRUE
)
ON CONFLICT (email) DO UPDATE
SET password_hash = COALESCE(platform.users.password_hash, EXCLUDED.password_hash);

INSERT INTO platform.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM platform.users u
JOIN platform.roles r ON r.code = 'platform_admin'
WHERE u.email = 'admin@example.com'
ON CONFLICT DO NOTHING;

INSERT INTO platform.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM platform.users u
JOIN platform.roles r ON r.code = 'admin'
WHERE u.email = 'admin@example.com'
ON CONFLICT DO NOTHING;
