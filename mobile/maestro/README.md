# Prodify Maestro E2E

Automated iOS smoke tests for release candidates.

## Flows

| File | Purpose |
|------|---------|
| `flows/smoke_test.yaml` | Full smoke: onboarding skip → login → session → tabs |
| `flows/onboarding_to_login.yaml` | Skip quiz onboarding and open login via `prodify://login` |
| `flows/login_with_credentials.yaml` | Sign in with `TEST_EMAIL` / `TEST_PASSWORD` |

## Prerequisites

1. **API user** — run once per environment:

   ```bash
   ./scripts/seed-e2e-user.sh
   ```

   Override defaults with `E2E_API_URL`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_TEST_USERNAME`.

2. **iOS simulator build** with E2E env (CI sets these automatically):

   - `EXPO_PUBLIC_API_URL` — reachable API (default: Render production)
   - `EXPO_PUBLIC_E2E_MODE=true` — bypasses paywall gate in simulator builds only

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
```

## GitHub Actions

Workflow: `.github/workflows/e2e.yml`

1. Trigger manually: **Actions → E2E Tests → Run workflow**
2. Or on PRs to `main` / `release/**` when `mobile/**` changes
3. Nightly cron at 02:30 UTC

Artifacts (screenshots, logs) upload on failure for 7 days.

## Updating flows

UI copy must match `mobile/locales/en.json`. After onboarding or paywall changes, re-run smoke locally before merging.
