# Prodify Screenshot Plan (en-US)

Last updated: 2026-07-07  
App version: 1.0.1  
Bundle/package: `com.prodify.app`

## Device Targets

- **iOS 6.7"** (iPhone 15 Pro Max / 1290x2796)
- **iOS 6.5"** (iPhone 11 Pro Max / 1242x2688) fallback
- **Android phone** (1080x1920 or Play-compliant 16:9+)

Store uploads should use native screenshots without OS chrome, notifications, or debug overlays.

## Global Capture Rules

- Use one consistent account with realistic seeded data.
- Use English locale (`en-US`) for this pack.
- Use dark theme only (consistent with brand look).
- Hide dev artifacts (`Expo` banners, debug toasts, FPS meters).
- Keep time/battery/network indicators clean and static.
- Avoid personal/sensitive data in usernames, emails, notes.

## Shot List (Order to Upload)

1. **Dashboard momentum**
   - Screen: `Dashboard`
   - Overlay copy: `Build studio consistency.`
   - Must show: streak hero + today plan + primary session CTA.

2. **Session setup flow**
   - Screen: `Session setup`
   - Overlay copy: `Start focused sessions in seconds.`
   - Must show: session type, mood, notes/tags controls.

3. **Session complete impact**
   - Screen: `Session complete`
   - Overlay copy: `See progress after every session.`
   - Must show: completion summary + goal impact.

4. **Stats and trends**
   - Screen: `Stats`
   - Overlay copy: `Track progress with clear insights.`
   - Must show: charts/trends + recent performance context.

5. **Social accountability**
   - Screen: `Friends`
   - Overlay copy: `Stay accountable with your circle.`
   - Must show: activity/leaderboard or social momentum UI.

6. **Profile and legal control**
   - Screen: `Profile`
   - Overlay copy: `Your data, your control.`
   - Must show: settings/legal section entry points.

## Capture Checklist

- [ ] Logged in with seeded production-like account
- [ ] No placeholder lorem text visible
- [ ] No loading spinners/skeletons in final captures
- [ ] No error banners/modals visible
- [ ] Typography and spacing match final design system
- [ ] Overlay text exported in safe area (not edge-clipped)
- [ ] File names follow naming convention below

## File Naming Convention

- `01_dashboard_momentum_ios67_en-US.png`
- `02_session_setup_ios67_en-US.png`
- `03_session_complete_ios67_en-US.png`
- `04_stats_trends_ios67_en-US.png`
- `05_social_accountability_ios67_en-US.png`
- `06_profile_legal_ios67_en-US.png`

Android equivalents replace `ios67` with `android`.

## Export and Handoff

- Export source screenshots to `mobile/store/screenshots/raw/`
- Export final composed versions (with overlays) to `mobile/store/screenshots/final/`
- Keep design source file (Figma/PSD reference link) in release ticket
- Upload in exact order listed above for both App Store and Play
