# One agent-device QA iteration for the fix loop (test -> diagnose -> fix -> retest).
# Designed for Cursor Agent: run repeatedly until exit code 0.

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

function Write-SuccessReport {
    param(
        [string]$Path,
        [int]$Iteration,
        [string]$RunUrl,
        [string]$Flow,
        [string]$Conclusion,
        [string]$DownloadDir,
        [string[]]$VideoPaths
    )
    $lines = @(
        "# agent-device QA - SUCCESS (iteration $Iteration)",
        "",
        "- Run: $RunUrl",
        "- Flow: $Flow",
        "- Conclusion: $Conclusion",
        "",
        "## Artifacts",
        "",
        "Download folder: $DownloadDir",
        "",
        "Screenshots: agent-device-artifacts/success.png"
    )
    if ($VideoPaths.Count -gt 0) {
        $lines += "", "## Video", ""
        $lines += $VideoPaths
    } else {
        $lines += "", "Video: not recorded."
    }
    $lines += "", "## Agent action", "", "Stop the fix loop. Summarize for the user."
    $lines | Set-Content -Path $Path -Encoding UTF8
}

function Write-FailureReport {
    param(
        [string]$Path,
        [int]$Iteration,
        [string]$RunUrl,
        [string]$Flow,
        [string]$Status,
        [string]$Conclusion,
        [string]$DownloadDir,
        [string]$FailedLog
    )
    $next = $Iteration + 1
    $lines = @(
        "# agent-device QA - FAILURE (iteration $Iteration)",
        "",
        "- Run: $RunUrl",
        "- Flow: $Flow",
        "- Status: $Status",
        "- Conclusion: $Conclusion",
        "",
        "## Failed step log (tail)",
        "",
        "``````",
        $FailedLog.TrimEnd(),
        "``````",
        "",
        "## Artifacts",
        "",
        "Download folder: $DownloadDir",
        "",
        "Check: agent-device-artifacts/failure.png, logs.txt",
        "",
        "## Agent action (fix loop)",
        "",
        "1. Read failure screenshot + logs + mobile/$Flow",
        "2. Fix in mobile/ or Maestro YAML",
        "3. git commit + git push",
        "4. Re-run: .\scripts\run-agent-device-fix-loop.ps1 -FullApp -SkipSeed -Iteration $next",
        "5. Repeat until exit 0 (max 5 iterations)"
    )
    $lines | Set-Content -Path $Path -Encoding UTF8
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
if ($LASTEXITCODE -ne 0) {
    Write-Host "gh run watch exited with code $LASTEXITCODE; polling until complete..."
    do {
        Start-Sleep -Seconds 15
        $status = & $Gh run view $runId --json status -q ".status"
    } while ($status -eq "in_progress" -or $status -eq "queued" -or $status -eq "waiting" -or $status -eq "requested" -or $status -eq "pending")
}

$conclusion = & $Gh run view $runId --json conclusion -q ".conclusion"
$status = & $Gh run view $runId --json status -q ".status"

if (-not $conclusion) {
    throw "Could not read CI conclusion for run $runId (status: $status)"
}

New-Item -ItemType Directory -Force -Path $IterDir | Out-Null
if (Test-Path $LatestDir) { Remove-Item -Recurse -Force $LatestDir }
New-Item -ItemType Directory -Force -Path $LatestDir | Out-Null

$downloadDir = Join-Path $IterDir "ci-artifacts"
New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
try {
    & $Gh run download $runId -D $downloadDir 2>&1 | Out-Null
} catch {
    Write-Host "Artifact download warning: $_"
}

Copy-Item -Recurse -Force $IterDir\* $LatestDir\

$failedLog = Get-FailedStepLog -Gh $Gh -RunId $runId
$reportPath = Join-Path $LatestDir "report.md"

if ($conclusion -eq "success") {
    $videoPaths = @(
        Get-ChildItem -Path $downloadDir -Recurse -Filter "*.mp4" -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName }
    )
    Write-SuccessReport -Path $reportPath -Iteration $Iteration -RunUrl $runUrl -Flow $Flow `
        -Conclusion $conclusion -DownloadDir $downloadDir -VideoPaths $videoPaths
    Write-Host ""
    Write-Host "SUCCESS - iteration $Iteration passed."
    Write-Host "Report: $reportPath"
    exit 0
}

Write-FailureReport -Path $reportPath -Iteration $Iteration -RunUrl $runUrl -Flow $Flow `
    -Status $status -Conclusion $conclusion -DownloadDir $downloadDir -FailedLog $failedLog

Write-Host ""
Write-Host "FAILURE - iteration $Iteration failed."
Write-Host "Report: $reportPath"
Write-Host ""
Write-Host "Re-run after fix: .\scripts\run-agent-device-fix-loop.ps1 -FullApp -SkipSeed -Iteration $($Iteration + 1)"
exit 1
