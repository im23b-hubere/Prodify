# Prodify Maestro E2E

Automated iOS smoke tests for release candidates.

## Flows

| File | Purpose |
|------|---------|
| `flows/smoke_test.yaml` | Full smoke: UI login → session → tabs |
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

2. **iOS simulator build** with E2E env (CI sets these automatically):

   - `EXPO_PUBLIC_API_URL` — reachable API (default: Render production)
   - `EXPO_PUBLIC_E2E_MODE=true` — bypasses paywall gate in simulator builds only
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

1. Trigger manually: **Actions → E2E Tests → Run workflow**
2. Or on PRs to `main` / `release/**` when `mobile/**` changes
3. Nightly cron at 02:30 UTC

Artifacts (screenshots, logs) upload on failure for 7 days.

## Updating flows

UI copy must match `mobile/locales/en.json`. After onboarding or paywall changes, re-run smoke locally before merging.
