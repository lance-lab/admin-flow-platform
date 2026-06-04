# First Milestone Architecture

## Runtime Flow

```text
React web shell -> Node.js gateway -> FastAPI module APIs -> PostgreSQL
```

The gateway owns platform-level concerns:

- Demo authentication.
- Permission checks.
- Module registry.
- Registry-driven proxying for `/api/modules/:moduleCode`.

Modules own their module-specific frontend, backend, translations, database schema, permissions,
and registry seed data. The platform shell imports registered frontend module definitions, while
the gateway resolves backend targets from `platform.modules`.

The Tenders module owns:

- Tender CRUD.
- Tender participants through references to Companies module records.
- External tender collection.
- Price evaluation.
- Document generation.
- Dynamic module-admin tables.
- Slovak and English module UI translations.

The Companies module owns:

- Company CRUD and registry verification.
- People, contact roles, and preferred contacts.
- Company bank accounts.
- Shared company data used by Tender workflows.
- Slovak and English module UI translations.

## Permission Model

Permissions are stored in `platform.permissions` and assigned to roles via `platform.role_permissions`.
The frontend renders modules and actions from the authenticated user's permissions, while the gateway
and module backends must enforce access server-side.

Seeded Tenders permissions:

- `tenders.read`
- `tenders.create`
- `tenders.update`
- `tenders.delete`
- `tenders.evaluate`
- `tenders.documents.generate`
- `tenders.admin.schema.manage`

Seeded Companies permissions:

- `companies.read`
- `companies.create`
- `companies.update`
- `companies.delete`
- `companies.verify`

## Database Schemas

- `platform`: users, roles, permissions, module registry.
- `dynamic`: metadata-driven dynamic table definitions and JSONB rows.
- `companies`: Shared company, person, and bank account tables used by module workflows.
- `tenders`: Tenders module tables, initialized from `modules/tenders/infra/postgres`.
