# Prodify Maestro E2E

Automated iOS smoke tests for release candidates.

## Flows

| File | Purpose |
|------|---------|
| `flows/e2e_login_smoke.yaml` | Fast tier: login + dashboard only (PR CI) |
| `flows/smoke_test.yaml` | Full smoke: login → session → tabs |
| `flows/full_app_test.yaml` | Extended coverage: smoke + secondary screens + legal |
| `flows/common/e2e_login_dashboard.yaml` | Sign in with `TEST_EMAIL` / `TEST_PASSWORD` and wait for dashboard |
| `flows/login_with_credentials.yaml` | Alias for `common/e2e_login_dashboard.yaml` |
| `flows/common/dismiss_overlays.yaml` | Dismiss first-run tutorial overlay |

## Prerequisites

1. **API user** — run once per environment:

   ```bash
   ./scripts/seed-e2e-user.sh
   ```

   Override defaults with `E2E_API_URL`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_TEST_USERNAME`.

   The script also stops any leftover **active session** on the E2E account so the dashboard shows `START SESSION`.

2. **iOS simulator build** with E2E env (CI sets these automatically):

   - `EXPO_PUBLIC_API_URL` — reachable API (default: Render production)
   - `EXPO_PUBLIC_E2E_MODE=true` — bypasses paywall gate in simulator builds only
   - `EXPO_PUBLIC_E2E_TEST_EMAIL` / `EXPO_PUBLIC_E2E_TEST_PASSWORD` — baked into E2E builds so Maestro can tap Sign in without typing into controlled inputs
   - `SENTRY_DISABLE_AUTO_UPLOAD=true` — required so Sentry does not fail unsigned CI builds

3. **[Maestro CLI](https://maestro.mobile.dev/)** installed locally.

## Local run

```bash
cd mobile
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
# Build & install on booted simulator (Xcode or xcodebuild — see .github/workflows/e2e.yml)

maestro test \
  -e TEST_EMAIL=test@prodify.app \
  -e TEST_PASSWORD='Test1234!' \
  maestro/flows/smoke_test.yaml

# Full app (macOS + simulator only)
maestro test \
  -e TEST_EMAIL=test@prodify.app \
  -e TEST_PASSWORD='Test1234!' \
  maestro/flows/full_app_test.yaml
```

## Windows (no Mac)

Use GitHub Actions instead of local Maestro:

```powershell
.\scripts\run-agent-device-qa.ps1 -FullApp -Watch
```

## GitHub Actions

Workflow: `.github/workflows/e2e.yml`

| Trigger | Build | Maestro flow | Typical duration |
|---------|-------|--------------|------------------|
| **Pull request** | Cached when native deps unchanged | `e2e_login_smoke.yaml` (fast) | ~8–15 min |
| **Nightly cron** | Cached when possible | `smoke_test.yaml` (full) | ~15–25 min |
| **Manual dispatch** | Cached when possible | `fast` or `full` (your choice) | ~8–25 min |
| **Push to `main`** | — | *not run* (use Prodify CI ~2 min) | — |

Prodify CI (unit/lint) runs on every push. Full macOS E2E is intentionally **not** tied to each `main` push.

Build and Maestro run in **separate jobs**. The simulator `.app` is uploaded as an artifact so Maestro-only changes reuse a cached Xcode build when native sources are unchanged. JS/TS changes invalidate the Xcode cache via bundle hash in the workflow.

### Fast local iteration (recommended during development)

```bash
cd mobile
# After one simulator install/build:
maestro test \
  -e TEST_EMAIL=test@prodify.app \
  -e TEST_PASSWORD='Test1234!' \
  maestro/flows/e2e_login_smoke.yaml
```

Re-run Maestro after flow/login tweaks without waiting for CI (~2–5 min locally vs ~35 min full pipeline).

1. Trigger manually: **Actions → E2E Tests → Run workflow**
2. Or on PRs to `main` / `release/**` when `mobile/**` changes
3. Nightly cron at 02:30 UTC (full smoke)

Artifacts (screenshots, logs) upload on failure for 7 days.

## Updating flows

UI copy must match `mobile/locales/en.json`. After onboarding or paywall changes, re-run smoke locally before merging.
