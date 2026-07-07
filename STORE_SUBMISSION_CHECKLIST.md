# Store Submission Checklist

Date: 2026-07-07

## Identity and Versioning

- [x] Bundle IDs set (`com.prodify.app` iOS/Android)
- [x] Version numbers finalized for release candidate (`1.0.1`)
- [ ] iOS `buildNumber` incremented for final upload (EAS `autoIncrement` handles remote; local `app.json` optional)
- [ ] Android `versionCode` incremented (if Android release planned)

## Visual Assets

- [ ] App icons verified in all required sizes
- [ ] Splash screen reviewed on target devices
- [ ] 3-5 iOS screenshots exported and QA checked
- [ ] 3-5 Android screenshots exported (if Android release planned)

Reference files:

- `mobile/store/STORE_METADATA.en-US.md`
- `mobile/store/STORE_METADATA.de-DE.md`
- `mobile/store/SCREENSHOT_PLAN.en-US.md`

## Listing Content

- [x] App description (EN) drafted
- [x] App description (DE) drafted/reviewed (`mobile/store/STORE_METADATA.de-DE.md`)
- [x] Keywords drafted
- [x] Promo text drafted

## Legal and Support

- [x] Privacy Policy URL present (`https://prodify.app/privacy`)
- [x] Terms URL present (`https://prodify.app/terms`)
- [x] Support URL/email present
- [ ] Age rating questionnaire completed in App Store Connect

## Compliance

- [ ] App tracking/privacy nutrition labels reviewed
- [ ] Export compliance/encryption questionnaire completed
- [ ] Account deletion flow tested from production build

## Final Submission Readiness

- [ ] TestFlight build approved for release
- [ ] Release notes finalized
- [ ] Submission screenshots and text proofread
