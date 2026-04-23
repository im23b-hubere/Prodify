# Test Results

Date: 2026-04-22
Repository: `C:\Prodify\Prodify`

## Gate 1 - Code Quality

### Backend

Command:

`python -m pytest --cov=app --cov-report=term-missing --cov-report=xml -q`

Result:

- Status: PASS
- Tests: 66 passed
- Total coverage: 74%
- Coverage report: `backend/coverage.xml`

Notes:

- No failing tests.
- Coverage is not uniformly high across all modules; low-coverage areas remain in several routers/services and should be increased in follow-up hardening.

### Mobile

Commands:

- `npm run lint`
- `npm run format:check`
- `npx tsc --noEmit`
- `npm test -- --ci --coverage=false`

Result:

- Status: PASS
- Lint: PASS
- Format check: PASS
- Typecheck: PASS
- Jest: 7 test suites passed, 21 tests passed

Notes:

- Jest logs one expected warning for missing Sentry DSN in test context (`EXPO_PUBLIC_SENTRY_DSN is missing; Sentry init skipped.`).
- No blocking warnings or errors remained after gate execution.
