# Release Readiness Report

Date: 2026-08-05

Scope: iOS production release candidate

App version: `1.0.1`

Current release branch: `codex/release-ready-blackbox`

## Executive status

Current recommendation: **NO-GO for App Store release, conditionally ready for a final TestFlight candidate.**

The current app source compiles as a native iOS simulator application, the full combined
black-box path passes, and signed production build 52 completed successfully. EAS Submit
submission `0b1f225c-1c4b-41d5-891d-fa2969f33e3b` is queued on Expo's Free Tier as of
2026-08-05; Apple upload and processing have therefore not started yet.

## Verified gates

- [x] Mobile lint passed.
- [x] Mobile TypeScript check passed.
- [x] Mobile Jest: 52/52 suites and 192/192 tests passed.
- [x] Expo Doctor: 18/18 checks passed.
- [x] Backend pytest: 102/102 tests passed.
- [x] Production API and database health passed.
- [x] Render remained responsive after several hours idle; the previous 45-108 second
      cold start is no longer reproducible after enabling always-on hosting.
- [x] Production Expo config resolves to `com.prodify.app`,
      `https://prodify-api-46b1.onrender.com`, environment `production`, entitlement
      `app_access`, and E2E bypass disabled.
- [x] Production configuration rejects a build when `EXPO_PUBLIC_E2E_MODE=true`.
- [x] Native iOS simulator build succeeded and was reused for the final full-flow replay.
- [x] Combined full-app iOS black-box replay passed on run `31006906910` at commit
      `6304499` (login, paywall gate, session lifecycle, tabs, secondary screens,
      weekly recap, progression, profile, notifications, legal screens, and dashboard).
- [x] Signed EAS production build 52 (`1.0.1`) completed from commit `5d983aa`.
      Subsequent commits through `6304499` modify QA/test isolation only, not shipped app code.
- [x] Paywall black-box and visual QA passed:
  - six months is the primary `BEST VALUE` choice;
  - weekly is visually secondary;
  - Restore Purchases, auto-renewal disclosure, Privacy, Terms, Sign out, and Delete
    account are visible.
- [x] Onboarding-to-login black-box flow passed.
- [x] Invalid-login recovery followed by successful login passed.
- [x] Dashboard, weekly recap, profile, legal screens, and notifications passed.
- [x] Tab navigation passed.
- [x] Deep links and secondary screens passed.
- [x] Live RevenueCat default offering verified:
  - `$rc_six_month` maps only to `prodify_6month_access`;
  - `$rc_weekly` maps only to `prodify_weekly_access`;
  - both products grant `app_access`;
  - both products are in subscription group `prodify_app_access`;
  - both products report App Store status `Waiting for Review`.
- [x] Legacy weekly and six-month products remain attached to `app_access`, preserving
      entitlement compatibility for existing test/legacy purchases.
- [x] Live App Store Connect subscription configuration verified and corrected:
  - `prodify_weekly_access` is one week, auto-renewing, CHF 10.00;
  - `prodify_6month_access` is six months, auto-renewing, CHF 50.00;
  - both products belong to `prodify_app_access`.

## Monetization configuration target

- Weekly auto-renewing subscription: `prodify_weekly_access`, CHF 10.00 (verified in App Store Connect).
- Six-month auto-renewing subscription: `prodify_6month_access`, CHF 50.00 (verified in App Store Connect).
- RevenueCat entitlement: `app_access`.
- Default offering must map `$rc_weekly` only to the weekly product and
  `$rc_six_month` only to the six-month product.

Store prices shown by the production app are supplied by Apple/RevenueCat. Simulator
prices are deterministic E2E fixtures and do not prove the live App Store configuration.

## Remaining release blockers

### P0 — before a final TestFlight candidate

- [x] Commit and push the stabilization of `full_app_test.yaml`.
- [x] Replay the combined full-app black-box flow successfully (run `31006906910`).
- [x] Confirmed the production Sentry DSN is present in the EAS production environment.
- [x] Expo iOS build capacity restored after the quota reset.
- [x] Build signed production binary 52 for version `1.0.1`.
- [x] Schedule only build 52 for TestFlight through EAS Submit.
- [ ] EAS Submit leaves the Free Tier Queue and uploads build 52 successfully.
- [ ] Build 52 finishes processing in TestFlight.

### P0 — before App Store submission

- [x] Verify live App Store Connect durations and Swiss price tiers for both products.
- [x] Verify the RevenueCat offering/package/product mapping and `app_access`
      entitlement.
- [ ] On a physical iPhone with the final TestFlight build, verify:
  - existing entitled account bypasses the paywall;
  - weekly sandbox purchase unlocks access;
  - six-month sandbox purchase unlocks access;
  - Restore Purchases unlocks a reinstall/new device;
  - cancellation/expiry removes access after RevenueCat refresh;
  - login, session creation, session completion, stats, sign out, and account deletion.
- [ ] Verify TestFlight launch and login over cellular as well as Wi-Fi.
- [x] App Store version metadata, support URL, five iPhone screenshots, manual release
      mode, subscription localization/review screenshots, 4+ age rating, and export
      compliance configuration are present.
- [ ] Reconcile the published privacy nutrition labels with the shipped SDK behavior.
      App Store Connect currently declares Product Interaction and Crash Data as tracking,
      while the app contains no ATT usage description or advertising/tracking SDK.
- [ ] Answer Apple's new social-media age-rating questions before 2026-09-07.

## Revenue expectation

The product and paywall can be optimized for conversion, but no test or implementation
can guarantee CHF 10,000 monthly revenue. After launch, measure paywall views, plan
selection, checkout conversion, trial/purchase completion, renewal, refund, and churn.
Use those measurements for controlled pricing and copy experiments.

## Release decision rule

Change to **GO** only after the final signed binary, live subscription mapping, physical
sandbox purchase/restore, and TestFlight smoke gates above are all evidenced as green.
