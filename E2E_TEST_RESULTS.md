# E2E Test Results

Date: 2026-07-07

## Scope

Critical release flows:

- [x] User login + dashboard (fast tier `e2e_login_smoke.yaml`)
- [x] Login prefill + AsyncStorage token persistence (E2E CI build)
- [ ] Full smoke: session start/stop + tabs (`smoke_test.yaml`) — run in progress
- [ ] XP sammeln und Level-up (not in smoke yet)
- [ ] Freunde-Vergleich (not in smoke yet)
- [ ] App-Neustart — Daten bleiben erhalten (not in smoke yet)
- [ ] Billing/Paywall IAP (bypassed via `EXPO_PUBLIC_E2E_MODE` in CI builds)

## Automated E2E Assets

| Flow | Path | Tier |
|------|------|------|
| Fast smoke | `mobile/maestro/flows/e2e_login_smoke.yaml` | PR / manual `fast` |
| Full smoke | `mobile/maestro/flows/smoke_test.yaml` | Nightly / manual `full` |
| Login + dashboard | `mobile/maestro/flows/common/e2e_login_dashboard.yaml` | Subflow |
| Seed script | `scripts/seed-e2e-user.sh` | Pre-Maestro |
| Workflow | `.github/workflows/e2e.yml` | Split `build-ios` + `maestro-ios` |
| Docs | `mobile/maestro/README.md` | |

## Execution Status

- GitHub **fast** tier: ✅ green on `cde03cf` ([run 28867541073](https://github.com/im23b-hubere/Prodify/actions/runs/28867541073))
- GitHub **full** tier: ⏳ in progress ([run 28869758919](https://github.com/im23b-hubere/Prodify/actions/runs/28869758919))
- Local manual execution: optional (`maestro test … e2e_login_smoke.yaml`)

## Run Commands

### Seed API user

```bash
./scripts/seed-e2e-user.sh
```

### Local Maestro (after simulator build)

```bash
cd mobile
maestro test -e TEST_EMAIL=test@prodify.app -e TEST_PASSWORD='Test1234!' maestro/flows/e2e_login_smoke.yaml
maestro test -e TEST_EMAIL=test@prodify.app -e TEST_PASSWORD='Test1234!' maestro/flows/smoke_test.yaml
```

### GitHub Actions

1. **Actions → E2E Tests → Run workflow**
2. Choose `test_profile`: `fast` (login only) or `full` (session + tabs)
3. Or: open PR touching `mobile/**` (runs `fast` automatically)

## CI build notes

E2E simulator builds set:

- `EXPO_PUBLIC_E2E_MODE=true` — paywall bypass for smoke only (never in EAS production)
- `EXPO_PUBLIC_API_URL` — default `https://prodify-api-46b1.onrender.com`
- Auth tokens stored in **AsyncStorage** in E2E mode (SecureStore lacks keychain entitlements on CI simulator)
- Simulator `.app` uploaded as **ZIP** to preserve bundle structure for `simctl install`
- `SENTRY_DISABLE_AUTO_UPLOAD=true` — prevents Sentry symbol upload from failing CI builds

## Evidence log

| Date | Commit | Profile | Workflow run | Result |
|------|--------|---------|--------------|--------|
| 2026-07-07 | `cde03cf` | fast | [28867541073](https://github.com/im23b-hubere/Prodify/actions/runs/28867541073) | ✅ PASS (~8 min) |
| 2026-07-07 | `cde03cf` | full | [28869758919](https://github.com/im23b-hubere/Prodify/actions/runs/28869758919) | ⏳ pending |

## Notes

- Maestro UI strings must stay aligned with `mobile/locales/en.json`.
- Fix failures from logs before re-triggering; do not retry blindly (~20 min per full pipeline).
