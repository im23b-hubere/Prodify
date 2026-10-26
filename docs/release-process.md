# Prodify – Release process (mobile)

## Store release vs. OTA update

| Change | Ship as | Command |
|--------|---------|---------|
| JavaScript/TypeScript, copy, styles, images | **OTA update** to existing builds | `npm run update:production -- "<message>"` |
| Paywall, prices, plans, subscription or renewal copy, sign-in and account deletion, permission prompts, new features | **New store build** for App Review, even when only JavaScript changed | `eas build --platform ios --profile production --auto-submit` |
| Native dependency added/upgraded, config plugin, `app.json`/`app.config.js` native fields, permissions, Expo SDK upgrade | **New store build** | `eas build --platform ios --profile production --auto-submit` |
| New public version in the App Store | **New store build** after bumping `expo.version` | same as above |

OTA updates may fix and polish what App Review saw, but must not change the app's purpose, its
purchase flow or what it asks the user for (App Review Guideline 2.5.2, Developer Program License
Agreement 3.3.1(b)). An OTA that changes the paywall would put a purchase flow in front of
customers that Apple never reviewed, so those changes always go through a store build.

OTA updates reach only builds with the same runtime. `runtimeVersion` follows `expo.version`
(`appVersion` policy), so bumping `version` cuts the new build off from earlier updates and vice
versa. Bump `version` only for an App Store release, never for a JS-only fix.

The first public release ships as **1.0.1** (decided Oct 2026; all TestFlight builds already use it).

## Build numbers

`eas.json` uses `appVersionSource: "remote"` with `autoIncrement` on the production profile. EAS
owns the iOS build number and Android `versionCode`; do not add `buildNumber` / `versionCode` to
`app.json`. Inspect or correct them with `eas build:version:get` / `eas build:version:set`.

## Environment variables

The EAS **production** environment is the only source of production config, for builds and OTA
updates alike (`eas env:list --environment production`). The local `mobile/.env` is for
development and must never feed a production bundle.

`npm run update:production` pulls the EAS environment, ignores `.env` and refuses to publish when
the app would not be a production config (wrong `EXPO_PUBLIC_APP_ENV`/runtime, missing Google
client ids, placeholder RevenueCat key, non-https API URL). Run it with `-- --check` to validate
without publishing. Do not call `eas update` directly for production.

Production store builds run the same check in `app.config.js` and fail early instead of shipping
an incomplete binary. CI verifies that the `production` profile in `eas.json` reads the EAS
environment and does not override it with an `env` block.

## Development client

`expo-dev-client` is added only to the `development` build profile. Production and staging builds
start without the dev menu.

## Checklist before an App Store release

1. Backend deployed on Render and healthy.
2. `npm run update:production -- --check` passes.
3. Bump `expo.version` if this is a new store version.
4. `eas build --platform ios --profile production --auto-submit`.
5. Smoke-test the TestFlight build: launch (no dev menu), sign-in (email, Google, Apple),
   paywall/purchase with a sandbox account, a focus session.
