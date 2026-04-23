# Database Setup

Date: 2026-04-22

## Production Database Policy

- Production must use a server database (`postgresql+psycopg://...`), not SQLite.
- SQLite is allowed only for local development/CI scenarios.

## Required Production Variables

- `DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>:5432/<db>`
- `ENVIRONMENT=production`

## Migration Strategy

1. Take a pre-deploy backup/snapshot.
2. Deploy application code compatible with current + new schema.
3. Run migration: `python -m alembic upgrade head`.
4. Run post-migration smoke checks (`/health`, key API endpoints).
5. Monitor errors/latency for at least 15 minutes.

## Local Validation Completed

Validated on local environment:

- `python -m alembic upgrade head` -> PASS

## Staging Validation (Required Before Production)

Run in staging environment:

1. Set staging `DATABASE_URL` to managed Postgres instance.
2. Run: `python -m alembic upgrade head`.
3. Verify revision:
   - `python -m alembic current`
4. Execute backend smoke tests.

Status: PENDING (requires staging infrastructure credentials).

## Rollback Scripts

Added script helpers:

- `scripts/db-migrate.sh`
- `scripts/db-rollback.sh`
- `scripts/db-migrate.ps1`
- `scripts/db-rollback.ps1`

Usage examples:

- Linux/macOS: `./scripts/db-migrate.sh head`
- Linux/macOS: `./scripts/db-rollback.sh -1`
- Windows PowerShell: `.\scripts\db-migrate.ps1 head`
- Windows PowerShell: `.\scripts\db-rollback.ps1 -1`

## Rollback Strategy

- For one-step rollback: `alembic downgrade -1`
- For revision rollback: `alembic downgrade <revision>`
- For full reset (non-prod only): `alembic downgrade base`

Always restore DB backup if data semantics changed and migration downgrade is not sufficient.
