# Configuration Documentation

Date: 2026-04-22

This document describes production-safe configuration for mobile and backend without exposing secrets.

## Mobile (Expo / EAS)

File: `mobile/eas.json`

Configured build profiles:

- `development`: local/internal testing with localhost API.
- `staging`: internal distribution on channel `staging`, environment `staging`.
- `production`: store build channel `production`, environment `production`, auto-increment enabled.

### Required EAS Environment Variables

Set these values in Expo EAS environment variables (Dashboard or CLI), not in Git:

- `EXPO_PUBLIC_API_URL` (staging and production)
- `EXPO_PUBLIC_SENTRY_DSN` (staging and production)
- `EXPO_PUBLIC_REVENUECAT_API_KEY` (if billing enabled)
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` (if billing enabled)

### Recommended Non-Secret Mobile Values

- `EXPO_PUBLIC_ENV=staging` for staging builds
- `EXPO_PUBLIC_ENV=production` for production builds
- `EXPO_PUBLIC_APP_ENV=staging` / `production`

## Backend (FastAPI)

Files:

- `backend/.env.example` (baseline sample)
- `backend/.env.production.example` (production template)

### Required Production Variables

- `ENVIRONMENT=production`
- `DATABASE_URL` (PostgreSQL or equivalent server DB)
- `SECRET_KEY` (strong random secret, min 50 chars)
- `INTERNAL_JOB_KEY` (strong random secret, 24+ chars)
- `WEBHOOK_SECRET` (32+ chars)
- `CORS_ORIGINS` (explicit HTTPS domains only, no wildcard)
- `SENTRY_DSN`

### Optional / Feature-Dependent Variables

- `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_AUTH`
- Push variables (`FCM_SERVER_KEY`, `APNS_*`, `EXPO_ACCESS_TOKEN`)
- Feature flags (`FEATURE_FLAG_*`)

## Secret Handling Rules

- Never commit production secrets to repository files.
- Keep real values in EAS Secrets (mobile) and hosting secret manager (backend).
- Use `.env.production.example` only as a template.
