# Final Go/No-Go Checklist

Date: 2026-08-12

Release version: `1.0.1`

Current release branch: `codex/release-ready-blackbox`

## Engineering gates

- [x] Mobile lint and TypeScript checks.
- [x] Mobile tests: 242/242.
- [x] Backend tests: 124/124.
- [x] Expo Doctor: 18/18.
- [x] Backend dependency audit: no known vulnerabilities.
- [x] Mobile production audit rejects every unaccepted high/critical advisory. Two
      unfixed Metro image-parser advisories are narrowly allowlisted as build-only;
      production iOS export passed and shipped assets contain no affected formats.
- [x] Fresh database upgraded from empty state through every Alembic migration and passed runtime schema validation at head.
- [x] Lockfile reproducibility verified with a clean `npm ci`.
- [x] Production-mode Hermes exports passed for iOS and Android.
- [x] Mobile and backend release versions aligned at `1.0.1` in source.
- [x] Production API and database health.
- [x] Render always-on idle verification.
- [x] Production config uses HTTPS Render API and disables E2E bypass.
- [x] Current native iOS simulator build.
- [x] Paywall visual and black-box QA.
- [x] Onboarding and login/recovery black-box QA.
- [x] Dashboard, stats, profile, tabs, legal screens, and deep links QA.
- [x] Combined full-app flow rerun after test-navigation stabilization (run `31006906910`).
- [x] Final app and QA changes pushed with a clean tracked worktree.

## Signed build and TestFlight gates

- [x] Expo iOS build capacity available.
- [x] Signed production build 52 from app version 1.0.1 and commit `5d983aa`.
- [x] Build 52 submitted to Expo EAS Submit (`0b1f225c-1c4b-41d5-891d-fa2969f33e3b`).
- [x] Expo submission left the Free Tier Queue and completed successfully.
- [x] Build uploaded and processed in TestFlight.
- [x] Build 52 assigned to the internal `Team (Expo)` tester group.
- [x] Correct version, build number, environment, and commit recorded.
- [ ] Physical-device smoke on Wi-Fi and cellular.
- [ ] No prolonged `Connecting securely` state.

## Subscription gates

- [x] `prodify_weekly_access`: one week, CHF 10.00, auto-renewing (verified in App Store Connect).
- [x] `prodify_6month_access`: six months, CHF 50.00, auto-renewing (verified in App Store Connect).
- [x] Both products belong to the intended App Store subscription group.
- [x] RevenueCat `$rc_weekly` maps only to the weekly product.
- [x] RevenueCat `$rc_six_month` maps only to the six-month product.
- [x] Both packages grant `app_access`.
- [ ] Existing entitled account bypasses paywall.
- [ ] Weekly sandbox purchase succeeds.
- [ ] Six-month sandbox purchase succeeds.
- [ ] Restore Purchases succeeds after reinstall/new device.
- [ ] Cancellation/expiry behavior verified.

## App Store Connect gates

- [x] Production Sentry DSN is present in the EAS production environment.
- [ ] Privacy nutrition labels reconciled with shipped SDK behavior; tracking is currently
      declared despite no ATT usage description or advertising/tracking SDK.
- [ ] Deploy the public `/legal/privacy` and `/legal/terms` pages, verify HTTP 200, and update App Store Connect to the new URLs.
- [x] Current age rating is 4+; new social-media questions remain due by 2026-09-07.
- [x] Export compliance is configured through `ITSAppUsesNonExemptEncryption=false`.
- [x] Subscription localization and review screenshots complete.
- [x] Five iPhone screenshots, metadata, support URL, and Privacy URL are present.
- [ ] Account deletion tested in the final production build.

## Decision

- [ ] GO
- [x] NO-GO — final signed build, live purchase verification, and store gates remain.

Do not submit for App Review until every unchecked P0 production gate is evidenced.
