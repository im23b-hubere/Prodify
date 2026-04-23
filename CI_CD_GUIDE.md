# CI/CD Guide

Date: 2026-04-22

## Pipelines

### Continuous Integration

Workflow: `.github/workflows/ci.yml`

Runs on push and pull requests:

- Backend:
  - Dependency install
  - Alembic migrations
  - Import smoke test
  - Python compile check
  - Pytest with coverage
  - `pip-audit` vulnerability scan
- Mobile:
  - `npm ci`
  - lint
  - format check
  - typecheck
  - jest tests
  - production dependency audit (`npm audit --omit=dev --audit-level=high`)

### E2E Pipeline

Workflow: `.github/workflows/e2e.yml`

- Current trigger: `workflow_dispatch` (manual)
- Scope: iOS simulator build + Maestro smoke flow

## Release Flow (Recommended)

1. Feature branch PR -> CI green.
2. Manual E2E run on release candidate commit.
3. Merge to `main`.
4. Build mobile production artifact (EAS).
5. Deploy backend with migrations.
6. Monitor Sentry and health endpoints.

## Required Secrets by Platform

- GitHub Actions: minimal CI secrets (if needed for private integrations).
- EAS: mobile env vars and secrets.
- Hosting provider: backend runtime secrets.

## Current Status

- CI workflow hardened with dependency security scans: DONE
- Manual E2E workflow available: DONE
- Last manual E2E successful run evidence: PENDING (requires GitHub Actions run)

## Operational Notes

- Keep CI as required status check before merge.
- Do not bypass failing audits without explicit risk acceptance.
