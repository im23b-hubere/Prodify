# E2E Test Results

Date: 2026-04-22

## Scope

Critical release flows:

- [ ] User Registration and Login
- [ ] Session erstellen und tracken
- [ ] Dashboard/Stats anzeigen
- [ ] XP sammeln und Level-up
- [ ] Freunde-Vergleich
- [ ] App-Neustart - Daten bleiben erhalten
- [ ] Billing/Paywall (falls implementiert)

## Automated E2E Assets in Repository

Existing Maestro flows:

- `mobile/maestro/flows/smoke_test.yaml`
- `mobile/maestro/flows/login_with_credentials.yaml`
- `mobile/maestro/flows/onboarding_then_login.yaml`

## Execution Status

- Local manual execution evidence: PENDING
- GitHub `e2e.yml` manual run evidence: PENDING

## Run Commands

Local (after simulator/device setup):

- `cd mobile`
- `maestro test maestro/flows/smoke_test.yaml`

GitHub manual run:

- Actions -> `E2E Tests` -> Run workflow

## Notes

- Final release requires at least one successful E2E run attached to release candidate commit.
- Update this file with run date, build SHA, and pass/fail evidence after execution.
