# E2E Test Results

Date: 2026-06-12

## Scope

Critical release flows:

- [x] User login (Maestro `login_with_credentials.yaml`)
- [x] Onboarding skip → login (`onboarding_to_login.yaml`)
- [x] Session start/stop (smoke_test dashboard section)
- [x] Dashboard / Stats / Friends / Profile tabs (smoke_test)
- [ ] XP sammeln und Level-up (not in smoke yet)
- [ ] Freunde-Vergleich (not in smoke yet)
- [ ] App-Neustart — Daten bleiben erhalten (not in smoke yet)
- [ ] Billing/Paywall IAP (bypassed via `EXPO_PUBLIC_E2E_MODE` in CI builds)

## Automated E2E Assets

| Flow | Path |
|------|------|
| Smoke | `mobile/maestro/flows/smoke_test.yaml` |
| Onboarding → login | `mobile/maestro/flows/onboarding_to_login.yaml` |
| Login only | `mobile/maestro/flows/login_with_credentials.yaml` |
| Seed script | `scripts/seed-e2e-user.sh` |
| Workflow | `.github/workflows/e2e.yml` |
| Docs | `mobile/maestro/README.md` |

## Execution Status

- Local manual execution evidence: PENDING
- GitHub `e2e.yml` run evidence: PENDING (trigger after merge)

## Run Commands

### Seed API user

```bash
./scripts/seed-e2e-user.sh
```

### Local Maestro (after simulator build)

```bash
cd mobile
maestro test -e TEST_EMAIL=test@prodify.app -e TEST_PASSWORD='Test1234!' maestro/flows/smoke_test.yaml
```

### GitHub Actions

1. **Actions → E2E Tests → Run workflow**
2. Optional inputs: API URL, test email/password/username
3. Or: push to `main` / open PR touching `mobile/**`

## CI build notes

E2E simulator builds set:

- `EXPO_PUBLIC_E2E_MODE=true` — paywall bypass for smoke only (never in EAS production)
- `EXPO_PUBLIC_API_URL` — default `https://prodify-api-46b1.onrender.com`
- `SENTRY_DISABLE_AUTO_UPLOAD=true` — prevents Sentry symbol upload from failing CI builds

If the workflow fails at **Prebuild iOS** or **Build app (simulator)**, check the step log for Sentry/`sentry-cli` errors and confirm the env vars above are present.

## Evidence log

| Date | Commit | Workflow run | Result |
|------|--------|--------------|--------|
| — | — | — | Add row after first green run |

## Notes

- Update the evidence log after the first successful GitHub Actions E2E run.
- Maestro UI strings must stay aligned with `mobile/locales/en.json`.
