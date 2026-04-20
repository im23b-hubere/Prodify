# Prodify Final Checklist (Go/No-Go)

Last validated: 2026-04-20

## MUST BE GREEN

- [x] Backend full test suite passes
  - Command: `cd backend && PYTHONPATH=. pytest --cov=app --cov-report=html`
  - Result: `47 passed`
- [x] Mobile lint passes
  - Command: `cd mobile && npm run lint`
- [ ] Mobile format check passes
  - Command: `cd mobile && npm run format:check`
  - Result: failed (Prettier reports style issues in multiple files)
- [x] Mobile TypeScript check passes
  - Command: `cd mobile && npx tsc --noEmit`
- [x] Mobile Jest test suite passes
  - Command: `cd mobile && npm test -- --ci --coverage=false`
  - Result: `6 suites, 17 tests passed`
- [ ] Maestro smoke test executable in current environment
  - Command: `cd mobile && maestro test maestro/flows/smoke_test.yaml`
  - Result: `maestro` command not found in current shell environment
- [ ] Manual smoke test on physical device completed
  - Result: pending manual execution

## READY TO SHIP

- [x] Repository/store metadata prepared
  - `mobile/store/STORE_METADATA.en-US.md`
  - `mobile/store/SCREENSHOT_PLAN.en-US.md`
- [x] Legal and compliance endpoints/links in place
  - `GET /legal/documents`
  - In-app Privacy/Terms routes
- [x] Deployment and rollback runbook available
  - `DEPLOYMENT_CHECKLIST.md`
- [x] Feature-flag kill switches available for critical flows
  - Billing sync
  - Push notifications
  - Smart nudges

## Current Decision

**No-Go until remaining MUST BE GREEN items are resolved**:
- run Prettier write/fix and re-check formatting
- ensure Maestro CLI is available in runtime shell and re-run smoke flow
- complete and sign off manual device smoke test
