# agent-device Fix Loop — automatic test → fix → retest

Prodify uses [agent-device](https://agent-device.dev/) on **GitHub Actions** (macOS) for iOS Simulator QA. **Fixes** are done by **Cursor Agent** in a loop.

## How it works

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ Cursor Agent│────▶│ GitHub Actions   │────▶│ iOS Sim +   │
│ (fix code)  │     │ agent-device CI  │     │ Maestro flow│
└─────────────┘     └──────────────────┘     └─────────────┘
       ▲                      │
       │                      ▼
       └──────── screenshots, logs, video, report.md
```

| Step | Who | What |
|------|-----|------|
| 1 | Script | Triggers CI, waits, downloads artifacts |
| 2 | agent-device | Replays `full_app_test.yaml` on simulator |
| 3 | On failure | Report → `artifacts/qa-loop/latest/report.md` |
| 4 | Cursor Agent | Reads report, fixes, pushes |
| 5 | Repeat | Until green (max 5 rounds by default) |
| 6 | Success | `success.png` + `full-app-run.mp4` in artifacts |

## Start the loop (Windows)

In **Cursor chat** (Agent mode):

> Starte den agent-device Fix-Loop bis alles grün ist.

Or one iteration manually:

```powershell
.\scripts\run-agent-device-fix-loop.ps1 -FullApp -Iteration 1
```

After a failure, the agent should push fixes and run:

```powershell
.\scripts\run-agent-device-fix-loop.ps1 -FullApp -SkipSeed -Iteration 2
```

## What is tested

See `mobile/maestro/flows/full_app_test.yaml` — login, session, tabs, notifications, legal, etc.

## What is NOT automatic

- agent-device alone does **not** edit your code
- The loop needs **Cursor Agent** (or you) to apply fixes between CI runs
- Physical iPhone testing is separate

## Cursor rule

`.cursor/rules/agent-device-qa-loop.mdc` — tells the agent how to run the loop autonomously.

## Cost

Public repo → GitHub macOS runners are free for standard usage.
