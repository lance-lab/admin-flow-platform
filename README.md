# Admin Flow Platform

Modular admin platform foundation using:

- React + TypeScript for the main shell and module UI.
- Node.js gateway for authentication, authorization, platform APIs, and module routing.
- FastAPI for module business logic.
- PostgreSQL for platform and module storage.

## First Milestone

This scaffold includes:

- React shell with login, layout, navigation, and permission-based module rendering.
- Node.js gateway with demo authentication, permission checks, and registry-driven module proxying.
- PostgreSQL platform schema plus module-owned schema and seed scripts.
- Tenders module placeholder route, frontend translations, backend API, and database setup.
- FastAPI Tenders backend with health check and placeholder API.
- Docker Compose for local development.

## Run Locally

Copy the example env file if you want to customize values:

```bash
cp .env.example .env
```

Start the stack:

```bash
docker compose up --build
```

Then open:

- Web app: http://localhost:5173
- Gateway health: http://localhost:3000/health
- Tenders API health: http://localhost:8001/health
- PostgreSQL: localhost:5432

## Demo Login

Use any email and password in the login screen. The gateway returns a demo user with permissions for the Tenders module.

## Repository Layout

```text
apps/
  web/              React main shell
  gateway/          Node.js API gateway
modules/
  tenders/
    backend/        FastAPI Tenders backend
    frontend/       Tenders React module package
    infra/          Tenders database schema and seed scripts
packages/
  shared-types/     Shared TypeScript contracts
infra/
  postgres/         Platform database initialization scripts
docs/
  architecture.md   Milestone architecture notes
```
