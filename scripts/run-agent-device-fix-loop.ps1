# One agent-device QA iteration for the fix loop (test -> diagnose -> fix -> retest).
# Designed for Cursor Agent: run repeatedly until exit code 0.
#
# Usage (human):
#   In Cursor chat: "Starte den agent-device Fix-Loop bis alles grün ist."
#
# Usage (agent, one iteration):
#   .\scripts\run-agent-device-fix-loop.ps1 -FullApp -Iteration 1
#   # on exit 1: read artifacts\qa-loop\latest\report.md, fix, push, increment iteration

param(
    [switch]$FullApp,
    [switch]$SkipSeed,
    [int]$Iteration = 1,
    [string]$ApiUrl = "https://prodify-api-46b1.onrender.com"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$LoopRoot = Join-Path $RepoRoot "artifacts\qa-loop"
$LatestDir = Join-Path $LoopRoot "latest"
$IterDir = Join-Path $LoopRoot ("iteration-{0:D2}" -f $Iteration)

function Resolve-GhCommand {
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if ($gh) { return $gh.Source }
    $path = "$env:ProgramFiles\GitHub CLI\gh.exe"
    if (Test-Path $path) { return $path }
    throw "GitHub CLI (gh) not found. Run: .\scripts\setup-gh.ps1"
}

function Get-FailedStepLog {
    param([string]$Gh, [int]$RunId)
    try {
        $lines = & $Gh run view $RunId --log-failed 2>&1
        if ($LASTEXITCODE -ne 0) { return ($lines | Out-String) }
        return ($lines | Select-Object -Last 60 | Out-String)
    } catch {
        return "Could not fetch failed logs: $_"
    }
}

Set-Location $RepoRoot
$Gh = Resolve-GhCommand
$WorkflowFile = "agent-device-ios.yml"
$Flow = if ($FullApp) { "maestro/flows/full_app_test.yaml" } else { "maestro/flows/smoke_test.yaml" }

Write-Host ""
Write-Host "=== agent-device QA iteration $Iteration ==="
Write-Host "Flow: $Flow"
Write-Host ""

if (-not $SkipSeed -and $Iteration -eq 1) {
    & "$PSScriptRoot\seed-e2e-user.ps1" -ApiUrl $ApiUrl
}

Write-Host "Triggering CI..."
& $Gh workflow run $WorkflowFile `
    -f "api_url=$ApiUrl" `
    -f "maestro_flow=$Flow"

if ($LASTEXITCODE -ne 0) {
    throw "Failed to trigger workflow $WorkflowFile"
}

Start-Sleep -Seconds 4
$runId = & $Gh run list --workflow=$WorkflowFile --limit 1 --json databaseId -q ".[0].databaseId"
$runUrl = & $Gh run view $runId --json url -q ".url"

Write-Host "Run ID: $runId"
Write-Host "URL:    $runUrl"
Write-Host ""
Write-Host "Waiting for CI (~15-25 min for full app)..."
& $Gh run watch $runId

$conclusion = & $Gh run view $runId --json conclusion -q ".conclusion"
$status = & $Gh run view $runId --json status -q ".status"

New-Item -ItemType Directory -Force -Path $IterDir | Out-Null
if (Test-Path $LatestDir) { Remove-Item -Recurse -Force $LatestDir }
New-Item -ItemType Directory -Force -Path $LatestDir | Out-Null

$downloadDir = Join-Path $IterDir "ci-artifacts"
New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
& $Gh run download $runId -D $downloadDir 2>&1 | Out-Null

# Mirror to latest/
Copy-Item -Recurse -Force $IterDir\* $LatestDir\

$failedLog = Get-FailedStepLog -Gh $Gh -RunId $runId
$reportPath = Join-Path $LatestDir "report.md"

if ($conclusion -eq "success") {
    $videoHint = ""
    $videoCandidates = Get-ChildItem -Path $downloadDir -Recurse -Filter "*.mp4" -ErrorAction SilentlyContinue
    if ($videoCandidates) {
        $videoHint = ($videoCandidates | ForEach-Object { $_.FullName }) -join "`n"
    }

    @"
# agent-device QA — SUCCESS (iteration $Iteration)

- Run: $runUrl
- Flow: ``$Flow``
- Conclusion: $conclusion

## Artifacts

Download folder: ``$downloadDir``

Screenshots: look for ``success.png`` under ``agent-device-artifacts/``

$(if ($videoHint) { "## Video`n`n$videoHint" } else { "Video: not recorded (enable full_app_test on CI)." })

## Agent action

Stop the fix loop. Summarize what was tested for the user.
"@ | Set-Content -Path $reportPath -Encoding UTF8

    Write-Host ""
    Write-Host "SUCCESS — iteration $Iteration passed."
    Write-Host "Report: $reportPath"
    exit 0
}

@(
    "# agent-device QA — FAILURE (iteration $Iteration)",
    "",
    "- Run: $runUrl",
    "- Flow: ``$Flow``",
    "- Status: $status",
    "- Conclusion: $conclusion",
    "",
    "## Failed step log (tail)",
    "",
    '```',
    $failedLog.TrimEnd(),
    '```',
    "",
    "## Artifacts",
    "",
    "Download folder: ``$downloadDir``",
    "",
    "Check:",
    "- ``agent-device-artifacts/failure.png``",
    "- ``agent-device-artifacts/logs.txt``",
    "",
    "## Agent action (fix loop)",
    "",
    "1. Read failure screenshot + logs + Maestro flow ``mobile/$Flow``",
    "2. Fix root cause in ``mobile/`` or the Maestro YAML (minimal diff)",
    "3. ``git commit`` + ``git push``",
    "4. Re-run: ``.\scripts\run-agent-device-fix-loop.ps1 -FullApp -SkipSeed -Iteration $($Iteration + 1)``",
    "5. Repeat until exit code 0 (max 5 iterations unless user asks for more)",
    "",
    "Do not change unrelated code. Prefer fixing flaky selectors / timing in Maestro before app logic."
) | Set-Content -Path $reportPath -Encoding UTF8

Write-Host ""
Write-Host "FAILURE — iteration $Iteration failed."
Write-Host "Report: $reportPath"
Write-Host ""
Write-Host "Cursor Agent: read the report, fix, push, then re-run with -Iteration $($Iteration + 1)"
exit 1
