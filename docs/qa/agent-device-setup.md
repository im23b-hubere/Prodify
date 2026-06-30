# agent-device Setup — Prodify (iOS)

This guide configures [agent-device](https://agent-device.dev/) for exploratory and regression QA of **Prodify** on the **iOS Simulator**. Prodify is an Expo/React Native app (`com.prodify.app`).

Related: Maestro E2E flows live in `mobile/maestro/`; agent-device can replay them via `--maestro` and adds AI-driven exploration, evidence capture, and `.ad` replay scripts.

See `docs/qa/agent-device-fix-loop.md` for the **automatic test → fix → retest loop** (Cursor Agent + CI).

---

**You cannot run the iOS Simulator or `xcodebuild` on Windows.** That is expected — not a misconfiguration.

Prodify iOS QA from Windows runs on **GitHub Actions** (`macos-15` runner) via agent-device:

### One-time setup

1. Install [GitHub CLI](https://cli.github.com/): `winget install GitHub.cli`
2. Authenticate: `gh auth login`
3. Push this repo (or your branch) so `.github/workflows/agent-device-ios.yml` exists on GitHub

### Run QA from PowerShell

```powershell
# Full app test (~15 min on GitHub's free macOS runner — no Mac needed)
.\scripts\run-agent-device-qa.ps1 -FullApp -Watch

# Fast smoke only (~10 min)
.\scripts\run-agent-device-qa.ps1 -Watch

# Download screenshots/logs after a run
.\scripts\run-agent-device-qa.ps1 -SkipSeed -DownloadArtifacts
```

**Cost:** You do not need a Mac or a paid cloud device farm. This workflow uses GitHub Actions `macos-15` runners. **Public repos** get macOS minutes included in the free tier. **Private repos** consume billable minutes (macOS counts ~10× Linux) — use `-FullApp` manually when you need deep coverage; keep smoke on PRs.

Or manually in GitHub: **Actions → agent-device iOS QA → Run workflow** (set `maestro_flow` to `maestro/flows/full_app_test.yaml` for full coverage).

### What CI does

1. Seeds E2E user (`test@prodify.app`)
2. Builds Prodify for iOS Simulator with `EXPO_PUBLIC_E2E_MODE=true`
3. Installs `agent-device` on the Mac runner
4. Replays a Maestro flow via `agent-device replay --maestro` (default: smoke; use `-FullApp` or workflow input for full app)
5. Uploads artifacts (`artifacts/agent-device-ios/`) — screenshots on success/failure

### Cursor on Windows

- `.cursor/rules/agent-device.mdc` — agent instructions (use CI workflow, not local iOS)
- `.cursor/mcp.json` — MCP cannot drive iOS from Windows; use `run-agent-device-qa.ps1` instead

---

## Prerequisites (macOS — local QA)

| Requirement | Notes |
|-------------|-------|
| **macOS** | iOS Simulator automation requires Xcode |
| **Xcode** | Latest stable recommended; Command Line Tools installed |
| **Node.js 22+** | `node --version` |
| **agent-device CLI** | Installed globally (see below) |
| **Cursor** | Project rule + MCP configured in `.cursor/` |

Verify Xcode:

```bash
xcodebuild -version
xcrun simctl list devices available
```

---

## 1. Install agent-device

```bash
npm install -g agent-device@latest
agent-device --version
agent-device help workflow
```

Optional — official Cursor skills for canonical agent workflows:

```bash
npx skills add callstackincubator/agent-device
npx skills add callstackincubator/agent-device --skill dogfood
```

If Cursor cannot find the global binary, locate it and use the absolute path in `.cursor/mcp.json`:

```bash
which agent-device
# e.g. /Users/you/.npm-global/bin/agent-device
```

---

## 2. Cursor configuration (already in repo)

| File | Purpose |
|------|---------|
| `.cursor/rules/agent-device.mdc` | Tells Cursor Agent how to run Prodify iOS QA |
| `.cursor/mcp.json` | MCP server: `agent-device mcp` |

After cloning or pulling, **restart Cursor** or reconnect MCP in Settings so the `agent-device` server is active.

---

## 3. Build Prodify for the iOS Simulator

agent-device controls an **installed** `.app` on a booted simulator — not Expo Go in isolation.

### Environment variables for QA builds

Set these when building (same as CI in `.github/workflows/e2e.yml`):

| Variable | Value | Purpose |
|----------|-------|---------|
| `EXPO_PUBLIC_E2E_MODE` | `true` | Bypass paywall / premium gate (see §4) |
| `EXPO_PUBLIC_API_URL` | e.g. `https://prodify-api-46b1.onrender.com` | Reachable API for auth |
| `EXPO_PUBLIC_APP_ENV` | `development` | Dev-oriented config |
| `SENTRY_DISABLE_AUTO_UPLOAD` | `true` | Avoid Sentry upload failures on unsigned sim builds |

### One-time native project generation

```bash
cd mobile
npm ci
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
```

### Build and install (local)

**Option A — Expo CLI (fastest for daily dev):**

```bash
cd mobile
export EXPO_PUBLIC_E2E_MODE=true
export EXPO_PUBLIC_API_URL=https://prodify-api-46b1.onrender.com
export SENTRY_DISABLE_AUTO_UPLOAD=true
npx expo run:ios --device "iPhone 16 Pro"
```

**Option B — xcodebuild (matches CI):**

```bash
# Boot a simulator (or use agent-device boot below)
xcrun simctl boot "iPhone 16 Pro" || true

cd mobile/ios
xcodebuild \
  -workspace Prodify.xcworkspace \
  -scheme Prodify \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath build \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO

# Install on booted simulator
APP_PATH=$(find build -path "*/Build/Products/*-iphonesimulator/Prodify.app" -type d | head -1)
xcrun simctl install booted "$APP_PATH"
```

### E2E API user

Seed the test account once per environment:

```bash
./scripts/seed-e2e-user.sh
# Defaults: test@prodify.app / Test1234!
```

Override with `E2E_API_URL`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` if needed.

---

## 4. `EXPO_PUBLIC_E2E_MODE` — supported and how to use it

Prodify **already supports** E2E mode. No app code changes are required.

### Implementation

- **Flag:** `mobile/lib/e2eMode.ts` — `isE2eModeEnabled()` returns `true` when `EXPO_PUBLIC_E2E_MODE === "true"` at **build time**.
- **Paywall bypass:** `mobile/lib/premiumAccess.ts` — returns premium access immediately when E2E mode is on.
- **Tab gate:** `mobile/app/(tabs)/_layout.tsx` — skips entitlement loading when E2E mode is on.

### Usage rules

1. Set `EXPO_PUBLIC_E2E_MODE=true` **before** `expo prebuild`, `expo run:ios`, or `xcodebuild` — it is baked into the JS bundle via Expo public env vars.
2. Use only on **simulator / CI** builds. **Never** set in production EAS profiles (`eas.json` → `production`).
3. CI already sets it: `.github/workflows/e2e.yml` line `EXPO_PUBLIC_E2E_MODE: "true"`.
4. Documented for Maestro: `mobile/maestro/README.md`.

### Verify E2E mode in a running build

After login, all four tabs (Dashboard, Stats, Friends, Profile) should load without hitting the paywall. If the paywall appears, rebuild with `EXPO_PUBLIC_E2E_MODE=true`.

---

## 5. agent-device — daily commands

### Bootstrap

```bash
# List simulators
agent-device devices --platform ios

# Boot simulator (pick a device name from the list)
agent-device boot --platform ios --device "iPhone 16 Pro"

# Confirm Prodify is installed
agent-device apps --platform ios | grep -i prodify
```

### Open Prodify

```bash
agent-device open com.prodify.app --platform ios --relaunch
```

Optional named session with replay script recording:

```bash
agent-device open com.prodify.app --platform ios --session prodify-smoke --save-script
```

### Inspect and interact

```bash
# Interactive elements only (token-efficient for agents)
agent-device snapshot -i -c -d 4

# Example output:
# @e1 [heading] "Prodify"
# @e2 [button] "Sign In"

agent-device press @e2
agent-device fill @e3 "test@prodify.app"
agent-device find "Sign In" click
agent-device scroll down 0.5
agent-device back
```

### Deep links

```bash
agent-device open "prodify://login" --platform ios
```

### Evidence on failure

```bash
agent-device screenshot ./artifacts/prodify-bug.png
agent-device logs mark "before login submit"
agent-device logs dump 50
agent-device record start ./artifacts/repro.mp4
# ... reproduce ...
agent-device record stop
```

### Clean state

```bash
agent-device settings clear-app-state
agent-device reinstall com.prodify.app ./path/to/Prodify.app --platform ios
```

### Close session

```bash
agent-device close
agent-device shutdown --platform ios
```

---

## 6. Record and replay flows

```bash
# Explore with script recording
agent-device open com.prodify.app --platform ios --session prodify-smoke --save-script
# ... navigate ...
agent-device close

# Replay later
agent-device replay ~/.agent-device/sessions/prodify-smoke-run.ad

# Experimental: heal stale selectors
agent-device replay -u ~/.agent-device/sessions/prodify-smoke-run.ad
```

Suggested smoke path (aligns with `mobile/maestro/flows/smoke_test.yaml`):

1. Launch → skip onboarding if shown
2. Login with E2E credentials
3. Visit Dashboard, Stats, Friends, Profile tabs
4. Open session setup (optional)

### Full app test (Windows — no Mac)

Flow: `mobile/maestro/flows/full_app_test.yaml`

Covers everything in smoke **plus**:

| Area | How |
|------|-----|
| Streak history | `prodify://streak/history` |
| Notifications | deep link + Profile settings row |
| Session trash | `prodify://session-trash` |
| Session setup | `prodify://session/setup` |
| Weekly recap | Stats → Open weekly recap |
| Progression / ranks | `prodify://progression-overview` |
| Public profile | Profile → View public profile |
| Legal | Privacy + Terms of use |

```powershell
.\scripts\run-agent-device-qa.ps1 -FullApp -Watch
```

Runs on GitHub Actions macOS runners — free for public repos, no local Mac required.

---

## 7. Suggested Cursor prompts

**Smoke test:**

> Use agent-device on the iOS Simulator. Open `com.prodify.app`, run a smoke test (login → all tabs). Screenshot and log any failures. Do not change business logic unless fixing a confirmed bug.

**Exploratory QA:**

> Read `agent-device help dogfood`. Explore Prodify onboarding and session flows. Save a replay script if the run succeeds.

---

## 8. Troubleshooting

| Issue | Action |
|-------|--------|
| `open` fails — no simulator | `agent-device boot --platform ios --device "iPhone 16 Pro"` |
| App not found | Rebuild and `xcrun simctl install booted …/Prodify.app` |
| Red RN error overlay | `agent-device help react-native` — dismiss overlay, retry |
| Paywall blocks tabs | Rebuild with `EXPO_PUBLIC_E2E_MODE=true` |
| MCP server won't start | Use absolute path to `agent-device` in `.cursor/mcp.json` |
| Login fails | Run `./scripts/seed-e2e-user.sh`; check `EXPO_PUBLIC_API_URL` |

---

## 9. CI workflow (Windows + macOS)

| File | Purpose |
|------|---------|
| `.github/workflows/agent-device-ios.yml` | Builds + runs agent-device on macOS |
| `scripts/run-agent-device-qa.ps1` | Windows trigger script |
| `scripts/seed-e2e-user.ps1` | Windows E2E user seed |
| `scripts/agent-device/run-ios-smoke.sh` | Smoke runner (CI + Mac local) |

Maestro E2E (without agent-device): `.github/workflows/e2e.yml`

---

## 10. References

- [agent-device docs](https://oss.callstack.com/agent-device/)
- [AI Agent Setup](https://oss.callstack.com/agent-device/docs/agent-setup)
- [Quick Start](https://oss.callstack.com/agent-device/docs/quick-start)
- Prodify Maestro E2E: `mobile/maestro/README.md`
- CI E2E workflow: `.github/workflows/e2e.yml`
- CI agent-device workflow: `.github/workflows/agent-device-ios.yml`
