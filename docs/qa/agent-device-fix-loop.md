# agent-device Fix Loop — automatic test → fix → retest

Prodify uses **Maestro on GitHub Actions** (macOS) for iOS Simulator QA. **Fixes** are done by **Cursor Agent** in a loop.

## How it works

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ Cursor Agent│────▶│ GitHub Actions   │────▶│ iOS Sim +   │
│ (fix code)  │     │ Maestro CI       │     │ Maestro flow│
└─────────────┘     └──────────────────┘     └─────────────┘
       ▲                      │
       │                      ▼
       └──────── screenshots, logs, report.md
```

| Step | Who | What |
|------|-----|------|
| 1 | Script | Triggers CI, waits, downloads artifacts |
| 2 | Maestro | Runs flow on simulator (Auto picks build vs replay) |
| 3 | On failure | Report → `artifacts/qa-loop/latest/report.md` |
| 4 | Cursor Agent | Reads report, fixes, pushes |
| 5 | Repeat | Until green (max 5 rounds by default) |
| 6 | Success | `success.png` in artifacts |

## Start the loop (Windows)

In **Cursor chat** (Agent mode):

> Starte den agent-device Fix-Loop bis alles grün ist.

Or one iteration manually:

```powershell
# Recommended: FastSmoke gate, then FullApp (~10-18 min replay-only)
.\scripts\run-agent-device-fix-loop.ps1 -FullApp -Staged -Iteration 1

# Quick Maestro-only iteration (~5 min replay-only)
.\scripts\run-agent-device-fix-loop.ps1 -FastSmoke -SkipSeed -Iteration 1
```

After a failure, the agent should push fixes and run:

```powershell
.\scripts\run-agent-device-fix-loop.ps1 -FullApp -Staged -SkipSeed -Iteration 2
```

**Auto mode is ON by default.** Maestro/script-only fixes skip the ~25 min iOS build.

## What is tested

See `mobile/maestro/flows/full_app_test.yaml` — login, session, tabs, notifications, legal, etc.

`-Staged` runs `bootstrap_dashboard.yaml` first (~3 min), then `full_app_test.yaml` only if smoke passes.

## What is NOT automatic

- CI alone does **not** edit your code
- The loop needs **Cursor Agent** (or you) to apply fixes between CI runs
- Physical iPhone testing is separate

## Cursor rule

`.cursor/rules/agent-device-qa-loop.mdc` — tells the agent how to run the loop autonomously.

## Cost

Public repo → GitHub macOS runners are free for standard usage.
