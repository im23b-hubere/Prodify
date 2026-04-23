# Prodify Production Readme

Date: 2026-04-22

This document is the production-focused companion to `README.md`.

## Production Architecture

- Mobile: Expo/React Native build via EAS
- API: FastAPI backend
- DB: PostgreSQL (required for production)
- Monitoring: Sentry (mobile + backend)

## Required Prerequisites

- Active Apple Developer membership
- App Store Connect app created
- Production domain + HTTPS backend URL
- Managed PostgreSQL database
- Sentry project(s) and DSN(s)

## Production Configuration

- Mobile profiles: see `mobile/eas.json`
- Mobile env docs: `CONFIG_DOCUMENTATION.md`
- Backend env template: `backend/.env.production.example`

## Build and Release Commands

### Backend

- Run migrations: `python -m alembic upgrade head`
- Start app (host-managed process): `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`

### Mobile iOS

- Production build: `eas build --platform ios --profile production`
- Submit to App Store Connect: `eas submit --platform ios --profile production`

## Quality and Security References

- Test results: `TEST_RESULTS.md`
- Security policy and checks: `SECURITY.md`
- CI/CD overview: `CI_CD_GUIDE.md`
- Monitoring runbook: `MONITORING_GUIDE.md`

## Release Operations

- Deployment steps: `DEPLOYMENT_CHECKLIST.md`
- Final decision template: `FINAL_CHECKLIST.md`
- Rollback process: `ROLLBACK_PLAN.md`
- Store submission checklist: `STORE_SUBMISSION_CHECKLIST.md`
