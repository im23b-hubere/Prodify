# Final Go/No-Go Checklist

Date: 2026-07-24

Release version: `1.0.1`

Current release branch: `codex/release-ready-blackbox`

## Engineering gates

- [x] Mobile lint and TypeScript checks.
- [x] Mobile tests: 192/192.
- [x] Backend tests: 102/102.
- [x] Expo Doctor: 18/18.
- [x] Production API and database health.
- [x] Render always-on idle verification.
- [x] Production config uses HTTPS Render API and disables E2E bypass.
- [x] Current native iOS simulator build.
- [x] Paywall visual and black-box QA.
- [x] Onboarding and login/recovery black-box QA.
- [x] Dashboard, stats, profile, tabs, legal screens, and deep links QA.
- [ ] Combined full-app flow rerun after local test-navigation stabilization.
- [ ] Final release commit pushed with a clean tracked worktree.

## Signed build and TestFlight gates

- [ ] Expo iOS build capacity available.
- [ ] New signed production build from the final commit.
- [ ] Build uploaded and processed in TestFlight.
- [ ] Correct version, build number, environment, and commit recorded.
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

- [ ] Production Sentry DSN and release reporting verified.
- [ ] Privacy nutrition labels confirmed.
- [ ] Age rating confirmed.
- [ ] Export compliance confirmed.
- [ ] Subscription localization and review screenshots complete.
- [ ] App screenshots, metadata, support URL, Privacy URL, and Terms URL complete.
- [ ] Account deletion tested in the final production build.

## Decision

- [ ] GO
- [x] NO-GO — final signed build, live purchase verification, and store gates remain.

Do not submit for App Review until every unchecked P0 production gate is evidenced.
