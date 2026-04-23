# Deployment Checklist

Date: 2026-04-22

## 1. Pre-Deployment

- [ ] `main` branch up to date and clean
- [ ] CI green on release commit
- [ ] Manual E2E run passed on release candidate
- [ ] Production secrets verified in host/EAS
- [ ] DB backup/snapshot created

## 2. Backend Deployment

- [ ] Deploy backend release artifact
- [ ] Run migration: `python -m alembic upgrade head`
- [ ] Verify revision: `python -m alembic current`
- [ ] Health checks:
  - [ ] `/health`
  - [ ] `/health/live`
  - [ ] `/health/ready`

## 3. Mobile Deployment (iOS)

- [ ] Build production binary with EAS (`eas build --platform ios --profile production`)
- [ ] Verify build metadata and environment values
- [ ] Upload/submit to TestFlight (`eas submit --platform ios --profile production`)
- [ ] Internal tester smoke validation passed

## 4. Post-Deployment Validation

- [ ] Login/registration works
- [ ] Session flow works end-to-end
- [ ] Dashboard/stats load without backend errors
- [ ] Crash-free monitoring and error baseline stable in Sentry
- [ ] Support email/contact path tested

## 5. Rollback Readiness

- [ ] Previous stable build still available
- [ ] Rollback DB command tested in staging
- [ ] Incident contacts and channels confirmed
