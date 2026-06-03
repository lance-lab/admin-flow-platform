import { query } from '../db.js';
import type { GatewayUser } from '../auth.js';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  locale: 'sk' | 'en';
  password_hash: string | null;
  active: boolean;
  password_set: boolean;
  roles: { code: string; name: string }[];
  created_at: string;
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
      u.password_hash,
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

export async function findUserPasswordHashByEmail(email: string) {
  const rows = await query<{ password_hash: string | null }>(
    `
    SELECT password_hash
    FROM platform.users
    WHERE email = $1 AND active = TRUE
    LIMIT 1
    `,
    [email]
  );

  return rows[0]?.password_hash ?? null;
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

export async function listEnabledModules(locale: string) {
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
      ON mt.module_code = m.code AND mt.locale = $1
    WHERE m.enabled = TRUE
    ORDER BY COALESCE(mt.name, m.name) ASC
    `,
    [locale]
  );

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    routePath: row.route_path,
    backendBaseUrl: row.backend_base_url,
    requiredPermission: row.required_permission,
    enabled: row.enabled
  }));
}

export async function listPlatformUsers() {
  const rows = await query<UserRow>(
    `
    SELECT
      u.id::text,
      u.email,
      u.display_name,
      u.locale,
      u.password_hash,
      u.active,
      (u.password_hash IS NOT NULL) AS password_set,
      u.created_at::text,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('code', r.code, 'name', r.name))
          FILTER (WHERE r.code IS NOT NULL),
        '[]'
      ) AS roles,
      '{}'::text[] AS permissions
    FROM platform.users u
    LEFT JOIN platform.user_roles ur ON ur.user_id = u.id
    LEFT JOIN platform.roles r ON r.id = ur.role_id
    GROUP BY u.id, u.email, u.display_name, u.locale, u.password_hash, u.active, u.created_at
    ORDER BY u.created_at DESC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    locale: row.locale,
    active: row.active,
    passwordSet: row.password_set,
    roles: row.roles,
    createdAt: row.created_at
  }));
}

export async function listPlatformRoles() {
  return query<{ code: string; name: string }>(
    `
    SELECT code, name
    FROM platform.roles
    ORDER BY name ASC
    `
  );
}

export async function createPlatformUser(input: {
  email: string;
  displayName: string;
  locale: 'sk' | 'en';
  roleCodes: string[];
}) {
  const users = await query<{ id: string; email: string; display_name: string; locale: 'sk' | 'en' }>(
    `
    INSERT INTO platform.users (email, display_name, locale, active)
    VALUES ($1, $2, $3, TRUE)
    RETURNING id::text, email, display_name, locale
    `,
    [input.email, input.displayName, input.locale]
  );

  const user = users[0];

  if (input.roleCodes.length > 0) {
    await query(
      `
      INSERT INTO platform.user_roles (user_id, role_id)
      SELECT $1::uuid, r.id
      FROM platform.roles r
      WHERE r.code = ANY($2)
      ON CONFLICT DO NOTHING
      `,
      [user.id, input.roleCodes]
    );
  }

  return user;
}

export async function updatePlatformUser(input: {
  id: string;
  displayName: string;
  locale: 'sk' | 'en';
  active: boolean;
  roleCodes: string[];
}) {
  const users = await query<{ id: string }>(
    `
    UPDATE platform.users
    SET display_name = $2, locale = $3, active = $4, updated_at = now()
    WHERE id = $1
    RETURNING id::text
    `,
    [input.id, input.displayName, input.locale, input.active]
  );

  if (!users[0]) {
    return null;
  }

  await query(
    `
    DELETE FROM platform.user_roles
    WHERE user_id = $1
    `,
    [input.id]
  );

  if (input.roleCodes.length > 0) {
    await query(
      `
      INSERT INTO platform.user_roles (user_id, role_id)
      SELECT $1::uuid, r.id
      FROM platform.roles r
      WHERE r.code = ANY($2)
      ON CONFLICT DO NOTHING
      `,
      [input.id, input.roleCodes]
    );
  }

  return users[0];
}

export async function deletePlatformUser(id: string) {
  const rows = await query<{ id: string }>(
    `
    DELETE FROM platform.users
    WHERE id = $1
    RETURNING id::text
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function createPasswordSetupToken(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  await query(
    `
    INSERT INTO platform.password_setup_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    `,
    [input.userId, input.tokenHash, input.expiresAt.toISOString()]
  );
}

export async function findPasswordSetupToken(tokenHash: string) {
  const rows = await query<{
    id: string;
    user_id: string;
    email: string;
    display_name: string;
    expires_at: string;
    used_at: string | null;
  }>(
    `
    SELECT
      t.id::text,
      t.user_id::text,
      u.email,
      u.display_name,
      t.expires_at::text,
      t.used_at::text
    FROM platform.password_setup_tokens t
    JOIN platform.users u ON u.id = t.user_id
    WHERE t.token_hash = $1 AND u.active = TRUE
    LIMIT 1
    `,
    [tokenHash]
  );

  return rows[0] ?? null;
}

export async function completePasswordSetup(input: {
  tokenId: string;
  userId: string;
  passwordHash: string;
}) {
  await query(
    `
    UPDATE platform.users
    SET password_hash = $1, updated_at = now()
    WHERE id = $2
    `,
    [input.passwordHash, input.userId]
  );

  await query(
    `
    UPDATE platform.password_setup_tokens
    SET used_at = now()
    WHERE id = $1
    `,
    [input.tokenId]
  );
}
