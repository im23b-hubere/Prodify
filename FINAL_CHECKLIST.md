# Prodify Final Checklist (Go/No-Go)

Last validated: 2026-04-20 (post blocker-fix batch)

## MUST BE GREEN

- [x] Backend full test suite passes
  - Command: `cd backend && PYTHONPATH=. pytest --cov=app --cov-report=html`
  - Result: `47 passed`
- [x] Mobile lint passes
  - Command: `cd mobile && npm run lint`
- [x] Mobile format check passes
  - Command: `cd mobile && npm run format:check`
  - Result: pass (after `npm run format -- --write`)
- [x] Mobile TypeScript check passes
  - Command: `cd mobile && npx tsc --noEmit`
- [x] Mobile Jest test suite passes
  - Command: `cd mobile && npm test -- --ci --coverage=false`
  - Result: `6 suites, 17 tests passed`
- [ ] Maestro smoke test completed on connected device/emulator
  - Command: `cd mobile && %USERPROFILE%/.maestro/bin/maestro.bat test maestro/flows/smoke_test.yaml`
  - Result: Maestro CLI executes, but run currently blocked with `Not enough devices connected (0)` (re-validated after fixes)
- [ ] Manual smoke test on physical device completed
  - Result: re-test required after blocker-fix batch
  - Fixed in code since previous manual run:
    - Forecast no longer shows "miss goal" for zero-session new users
    - Stats "Sessions per day" renders full 7-day window, including zero days
    - Dashboard/Stats spacing hierarchy adjusted
    - Tab-switch loading hardened (focus reload + race guards)
    - Milestones vs Levels copy clarified (separate systems)
    - Paywall offering fallback improved (`offerings.current` -> first available offering)
    - Paywall now shows explicit reasons for unavailable plans (missing config / Expo Go limitation)
    - Onboarding is now forced for new registrations
    - App launch now shows a branded loading state during font hydration

## READY TO SHIP

- [x] Repository/store metadata prepared
  - `mobile/store/STORE_METADATA.en-US.md`
  - `mobile/store/SCREENSHOT_PLAN.en-US.md`
- [x] Legal and compliance endpoints/links in place
  - `GET /legal/documents`
  - In-app Privacy/Terms routes
- [x] Deployment and rollback runbook available
  - `DEPLOYMENT_CHECKLIST.md`
- [x] Feature-flag kill switches available for critical flows
  - Billing sync
  - Push notifications
  - Smart nudges

## Current Decision

**No-Go until remaining MUST BE GREEN items are resolved**:
- start at least one Android/iOS device, then re-run Maestro smoke flow
- complete and sign off manual device smoke test after the above fixes

## Next Verification Pass (recommended order)

1. Run Maestro smoke flow on a connected device/emulator.
2. Execute physical-device manual smoke focused on:
   - first-run onboarding experience
   - paywall behavior (and expected Expo Go limitation messaging)
   - dashboard/stats rendering under rapid tab switching
3. If both pass, mark both remaining MUST BE GREEN checks as complete and move to Go.
