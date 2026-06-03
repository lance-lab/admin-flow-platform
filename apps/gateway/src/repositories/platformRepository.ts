import { query } from '../db.js';
import type { GatewayUser } from '../auth.js';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  locale: 'sk' | 'en';
  permissions: string[];
}

interface ModuleRow {
  code: string;
  name: string;
  description: string;
  route_path: string;
  backend_base_url: string;
  required_permission: string;
  enabled: boolean;
}

export async function findUserByEmail(email: string): Promise<GatewayUser | null> {
  const rows = await query<UserRow>(
    `
    SELECT
      u.id::text,
      u.email,
      u.display_name,
      u.locale,
      COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
    FROM platform.users u
    LEFT JOIN platform.user_roles ur ON ur.user_id = u.id
    LEFT JOIN platform.role_permissions rp ON rp.role_id = ur.role_id
    LEFT JOIN platform.permissions p ON p.id = rp.permission_id
    WHERE u.email = $1 AND u.active = TRUE
    GROUP BY u.id, u.email, u.display_name, u.locale
    `,
    [email]
  );

  const user = rows[0];

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    locale: user.locale,
    permissions: user.permissions
  };
}

export async function listEnabledModulesForPermissions(permissions: string[], locale: string) {
  const rows = await query<ModuleRow>(
    `
    SELECT
      m.code,
      COALESCE(mt.name, m.name) AS name,
      COALESCE(mt.description, m.description) AS description,
      m.route_path,
      m.backend_base_url,
      m.required_permission,
      m.enabled
    FROM platform.modules m
    LEFT JOIN platform.module_translations mt
      ON mt.module_code = m.code AND mt.locale = $2
    WHERE m.enabled = TRUE AND m.required_permission = ANY($1)
    ORDER BY COALESCE(mt.name, m.name) ASC
    `,
    [permissions, locale]
  );

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    routePath: row.route_path,
    requiredPermission: row.required_permission,
    enabled: row.enabled
  }));
}

export async function findEnabledModuleByCode(code: string) {
  const rows = await query<ModuleRow>(
    `
    SELECT code, name, description, route_path, backend_base_url, required_permission, enabled
    FROM platform.modules
    WHERE code = $1 AND enabled = TRUE
    LIMIT 1
    `,
    [code]
  );

  const module = rows[0];

  if (!module) {
    return null;
  }

  return {
    code: module.code,
    name: module.name,
    description: module.description,
    routePath: module.route_path,
    backendBaseUrl: module.backend_base_url,
    requiredPermission: module.required_permission,
    enabled: module.enabled
  };
}
