# Prodify Deployment Checklist

Last updated: 2026-04-20  
Release target: Production (`com.prodify.app`)

## 1) Pre-Deploy Gate (Must Be Green)

- [ ] `git status` is clean (only intended release changes).
- [ ] Latest commits for current release checkpoints are merged.
- [ ] CI is green (`.github/workflows/ci.yml`).
- [ ] Backend tests pass locally:
  - [ ] `cd backend`
  - [ ] `pytest --cov=app --cov-report=html`
- [ ] Mobile checks pass locally:
  - [ ] `cd mobile`
  - [ ] `npm run lint`
  - [ ] `npm run format:check`
  - [ ] `npx tsc --noEmit`
  - [ ] `npm test -- --ci --coverage=false`
- [ ] Manual smoke flow validated on device/emulator:
  - [ ] Register/Login
  - [ ] Session setup -> start -> stop -> complete
  - [ ] Dashboard/Stats/Friends/Profile navigation
  - [ ] Push ping test works

## 2) Production Config Verification

## Backend
- [ ] `ENVIRONMENT=production`
- [ ] `DATABASE_URL` points to production DB (not SQLite)
- [ ] `SECRET_KEY`, `WEBHOOK_SECRET` are strong and non-placeholder
- [ ] `SENTRY_DSN` configured
- [ ] `REVENUECAT_SECRET_KEY` configured
- [ ] `EXPO_ACCESS_TOKEN` configured
- [ ] `CORS_ORIGINS` set to production origins only
- [ ] `LEGAL_*` and `SUPPORT_EMAIL` values are correct

## Mobile (EAS production profile)
- [ ] `EXPO_PUBLIC_API_URL=https://api.prodify.app`
- [ ] `EXPO_PUBLIC_SENTRY_DSN` configured
- [ ] `EXPO_PUBLIC_ENV=production`
- [ ] `mobile/app.json` version/build numbers prepared

## 3) Backend Deployment Sequence

- [ ] Backup production database before migration.
- [ ] Deploy backend image/artifact.
- [ ] Run migrations: `python -m alembic upgrade head`
- [ ] Start/restart backend service.
- [ ] Verify health endpoints:
  - [ ] `GET /health/live` -> `200`
  - [ ] `GET /health/ready` -> `200`
  - [ ] `GET /health` -> `status=ok`

## 4) Mobile Release Sequence

- [ ] Build production binaries:
  - [ ] `cd mobile`
  - [ ] `eas build --platform ios --profile production`
  - [ ] `eas build --platform android --profile production`
- [ ] Install and smoke test production artifacts.
- [ ] Submit store builds:
  - [ ] `eas submit --platform ios --profile production`
  - [ ] `eas submit --platform android --profile production`
- [ ] App Store metadata and screenshot packs are final:
  - [ ] `mobile/store/STORE_METADATA.en-US.md`
  - [ ] `mobile/store/SCREENSHOT_PLAN.en-US.md`

## 5) Post-Deploy Verification (First 60 Minutes)

- [ ] Sentry shows no new critical startup errors.
- [ ] API error rate remains within normal baseline.
- [ ] `GET /health/ready` remains stable over multiple checks.
- [ ] Billing sync endpoint returns expected responses.
- [ ] Push token registration and push ping succeed.
- [ ] New user registration + first session flow succeeds end-to-end.

## 6) Rollback Decision Triggers

Rollback immediately if one of these occurs:

- [ ] `health/ready` fails continuously (>5 minutes)
- [ ] Auth/register/login broken for new users
- [ ] Session start/stop broken for majority of requests
- [ ] Severe billing or entitlement mismatch in production
- [ ] Crash spike or 5xx spike significantly above baseline

## 7) Rollback Steps (Backend First)

- [ ] Re-deploy previous known-good backend artifact.
- [ ] Run DB rollback only if migration is proven reversible and required:
  - [ ] `python -m alembic downgrade -1`
- [ ] Re-check `health/live` + `health/ready`.
- [ ] Confirm critical user flows are restored.
- [ ] Announce incident + mitigation summary to team.

## 8) Release Sign-Off

- [ ] Deployment owner sign-off
- [ ] QA sign-off
- [ ] Product sign-off
- [ ] Release notes posted
