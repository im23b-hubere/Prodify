# Final Go/No-Go Checklist

Date: 2026-04-22
Release version: `<set-version>`
Commit SHA: `<set-sha>`

## Gate Status

- [ ] 1. Code Quality Gate
- [ ] 2. Config Gate (Mobile Production)
- [ ] 3. Config Gate (Backend Production)
- [ ] 4. Database Gate
- [ ] 5. Observability Gate
- [ ] 6. Security Gate
- [ ] 7. CI Gate
- [ ] 8. E2E/Smoke Gate
- [ ] 9. Store Readiness Gate
- [ ] 10. Rollback Gate

## Blocking Criteria (Any = No-Go)

- [ ] Missing production API URL or DB connection
- [ ] Missing Sentry DSN for required runtime
- [ ] Failed migrations or unknown DB revision state
- [ ] CI red on release commit
- [ ] E2E not executed on release candidate
- [ ] Missing legal/support links in store listing

## Decision

- [ ] GO
- [ ] NO-GO

Decision owner: `<name>`
Date/time: `<timestamp>`
Notes: `<brief rationale>`
