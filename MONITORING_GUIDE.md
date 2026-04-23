# Monitoring Guide

Date: 2026-04-22

This guide defines Sentry setup for mobile and backend release monitoring.

## Sentry Projects

Create two Sentry projects:

- Mobile project (React Native)
- Backend project (FastAPI/Python)

## Mobile Sentry Setup

Required env vars (EAS):

- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_ENV` (`staging` or `production`)

Required checks:

1. Build staging app with `EXPO_PUBLIC_ENV=staging`.
2. Trigger a test error in staging.
3. Confirm event appears in Sentry under staging environment.
4. Build production app with `EXPO_PUBLIC_ENV=production`.
5. Confirm release + environment tags are visible.

Source maps:

- Use EAS build with Sentry plugin enabled in `mobile/app.json`.
- Ensure source map upload is enabled in CI/EAS build logs.

## Backend Sentry Setup

Required env vars:

- `SENTRY_DSN`
- `ENVIRONMENT=production` (or `staging` in staging)

Required checks:

1. Deploy backend with Sentry DSN.
2. Trigger controlled test exception endpoint/job in staging.
3. Verify event received with environment tag.
4. Confirm traceback and release metadata are visible.

## Health and Alerting Baseline

- Track error rate and p95 latency.
- Alert on:
  - New fatal exceptions
  - Error burst over baseline
  - Repeated auth/session failures

## Required Links (Fill In)

- Sentry org URL: `<add-org-url>`
- Mobile project URL: `<add-mobile-project-url>`
- Backend project URL: `<add-backend-project-url>`
- Mobile release dashboard URL: `<add-mobile-release-url>`
- Backend release dashboard URL: `<add-backend-release-url>`

## Verification Status

- Mobile DSN configured: PENDING
- Backend DSN configured: PENDING
- Test error verified (mobile): PENDING
- Test error verified (backend): PENDING
