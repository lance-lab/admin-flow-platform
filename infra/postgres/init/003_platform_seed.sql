INSERT INTO platform.permissions (code, description)
VALUES
  ('platform.modules.read', 'Read available platform modules'),
  ('platform.modules.manage', 'Manage platform modules')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.roles (code, name)
VALUES ('platform_admin', 'Platform Admin')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.code = 'platform_admin'
ON CONFLICT DO NOTHING;

INSERT INTO platform.users (email, display_name, active)
VALUES ('admin@example.com', 'Platform Admin', TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO platform.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM platform.users u
JOIN platform.roles r ON r.code = 'platform_admin'
WHERE u.email = 'admin@example.com'
ON CONFLICT DO NOTHING;
