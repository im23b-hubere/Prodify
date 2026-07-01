# One agent-device QA iteration for the fix loop (test -> diagnose -> fix -> retest).
# Designed for Cursor Agent: run repeatedly until exit code 0.

param(
    [switch]$FullApp,
    [switch]$FastSmoke,
    [switch]$SkipSeed,
    [switch]$Auto,
    [switch]$ReplayOnly,
    [string]$AppArtifactRunId,
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
    param([string]$Gh, [string]$RunId)
    try {
        $lines = & $Gh run view $RunId --log-failed 2>&1
        if ($LASTEXITCODE -ne 0) { return ($lines | Out-String) }
        return ($lines | Select-Object -Last 60 | Out-String)
    } catch {
        return "Could not fetch failed logs: $_"
    }
}

function Test-RunArtifact {
    param([string]$Gh, [string]$RunId, [string]$Name)
    try {
        $artifacts = & $Gh api "repos/im23b-hubere/Prodify/actions/runs/$RunId/artifacts" 2>$null | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0 -or -not $artifacts) { return $false }
        return @($artifacts.artifacts | Where-Object { $_.name -eq $Name -and -not $_.expired }).Count -gt 0
    } catch {
        return $false
    }
}

function Get-LatestRunWithArtifact {
    param([string]$Gh, [string]$WorkflowFile, [string]$ArtifactName)
    $runs = & $Gh run list --workflow=$WorkflowFile --limit 20 --json databaseId,status,headSha,createdAt | ConvertFrom-Json
    foreach ($run in $runs) {
        if ($run.status -ne "completed") { continue }
        $runId = [string]$run.databaseId
        if (Test-RunArtifact -Gh $Gh -RunId $runId -Name $ArtifactName) {
            return [pscustomobject]@{
                RunId = $runId
                HeadSha = [string]$run.headSha
            }
        }
    }
    return $null
}

function Test-NeedsFreshAppBuild {
    param([string]$BaseSha)
    if ([string]::IsNullOrWhiteSpace($BaseSha)) { return $true }

    $headSha = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($headSha)) { return $true }
    if ($headSha -eq $BaseSha) { return $false }

    $changedFiles = @(git diff --name-only "$BaseSha..HEAD" 2>$null)
    if ($LASTEXITCODE -ne 0) { return $true }
    if ($changedFiles.Count -eq 0) { return $false }

    $appImpactingPrefixes = @(
        "mobile/app/",
        "mobile/assets/",
        "mobile/components/",
        "mobile/constants/",
        "mobile/context/",
        "mobile/features/",
        "mobile/hooks/",
        "mobile/lib/",
        "mobile/types/"
    )
    $appImpactingFiles = @(
        "mobile/app.json",
        "mobile/eas.json",
        "mobile/package.json",
        "mobile/package-lock.json",
        "mobile/babel.config.js",
        "mobile/metro.config.js"
    )

    foreach ($file in $changedFiles) {
        $normalized = $file.Replace("\", "/")
        if ($appImpactingFiles -contains $normalized) { return $true }
        foreach ($prefix in $appImpactingPrefixes) {
            if ($normalized.StartsWith($prefix)) { return $true }
        }
    }

    return $false
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
        [string]$RunId,
        [string]$RunUrl,
        [string]$Flow,
        [string]$Status,
        [string]$Conclusion,
        [string]$DownloadDir,
        [string]$FailedLog,
        [bool]$AppArtifactAvailable,
        [string]$ReplayAppArtifactRunId
    )
    $next = $Iteration + 1
    $flowSwitch = if ($FullApp) { "-FullApp " } elseif ($FastSmoke) { "-FastSmoke " } else { "" }
    $rerunCommand = ".\scripts\run-agent-device-fix-loop.ps1 ${flowSwitch}-Auto -SkipSeed -Iteration $next"
    if ($AppArtifactAvailable) {
        $rerunCommand = ".\scripts\run-agent-device-fix-loop.ps1 ${flowSwitch}-Auto -SkipSeed -Iteration $next"
    }
    $lines = @(
        "# agent-device QA - FAILURE (iteration $Iteration)",
        "",
        "- Run: $RunUrl",
        "- Run ID: $RunId",
        "- Flow: $Flow",
        "- Status: $Status",
        "- Conclusion: $Conclusion",
        "- Replay app artifact available: $AppArtifactAvailable",
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
        "4. Re-run: $rerunCommand",
        "5. Repeat until exit 0 (max 5 iterations)"
    )
    $lines | Set-Content -Path $Path -Encoding UTF8
}

Set-Location $RepoRoot
$Gh = Resolve-GhCommand
$WorkflowFile = "agent-device-ios.yml"
$Flow = if ($FullApp) { "maestro/flows/full_app_test.yaml" } else { "maestro/flows/smoke_test.yaml" }
if ($FastSmoke) {
    $Flow = "maestro/flows/bootstrap_dashboard.yaml"
}

if ($Auto) {
    $latestArtifact = Get-LatestRunWithArtifact -Gh $Gh -WorkflowFile $WorkflowFile -ArtifactName "ios-simulator-app"
    if ($latestArtifact) {
        $needsBuild = Test-NeedsFreshAppBuild -BaseSha $latestArtifact.HeadSha
        if (-not $needsBuild) {
            $ReplayOnly = $true
            $AppArtifactRunId = $latestArtifact.RunId
        }
    }
}

$QaMode = if ($ReplayOnly) { "replay-only" } else { "build-and-test" }
$SeedApiUser = if ($SkipSeed) { "false" } else { "true" }

if ($ReplayOnly -and [string]::IsNullOrWhiteSpace($AppArtifactRunId)) {
    throw "-AppArtifactRunId is required when using -ReplayOnly"
}

Write-Host ""
Write-Host "=== agent-device QA iteration $Iteration ==="
Write-Host "Flow: $Flow"
Write-Host "QA mode: $QaMode"
if ($Auto) {
    Write-Host "Auto mode: enabled"
}
if ($ReplayOnly) {
    Write-Host "App artifact run: $AppArtifactRunId"
}
Write-Host ""

if (-not $SkipSeed -and $Iteration -eq 1) {
    & "$PSScriptRoot\seed-e2e-user.ps1" -ApiUrl $ApiUrl
}

Write-Host "Triggering CI..."
& $Gh workflow run $WorkflowFile `
    -f "api_url=$ApiUrl" `
    -f "maestro_flow=$Flow" `
    -f "qa_mode=$QaMode" `
    -f "app_artifact_run_id=$AppArtifactRunId" `
    -f "seed_api_user=$SeedApiUser"

if ($LASTEXITCODE -ne 0) {
    throw "Failed to trigger workflow $WorkflowFile"
}

Start-Sleep -Seconds 4
$runId = & $Gh run list --workflow=$WorkflowFile --limit 1 --json databaseId -q ".[0].databaseId"
$runUrl = & $Gh run view $runId --json url -q ".url"

Write-Host "Run ID: $runId"
Write-Host "URL:    $runUrl"
Write-Host ""
if ($ReplayOnly) {
    Write-Host "Waiting for CI (~5-10 min for replay-only)..."
} else {
    Write-Host "Waiting for CI (~20-40 min for build-and-test full app)..."
}
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
$appArtifactAvailable = Test-RunArtifact -Gh $Gh -RunId $runId -Name "ios-simulator-app"
$replayAppArtifactRunId = if ($ReplayOnly) { $AppArtifactRunId } else { $runId }
if ($ReplayOnly -and -not [string]::IsNullOrWhiteSpace($AppArtifactRunId)) {
    $appArtifactAvailable = Test-RunArtifact -Gh $Gh -RunId $AppArtifactRunId -Name "ios-simulator-app"
}

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
    -RunId $runId -Status $status -Conclusion $conclusion -DownloadDir $downloadDir -FailedLog $failedLog `
    -AppArtifactAvailable $appArtifactAvailable -ReplayAppArtifactRunId $replayAppArtifactRunId

Write-Host ""
Write-Host "FAILURE - iteration $Iteration failed."
Write-Host "Report: $reportPath"
Write-Host ""
if ($appArtifactAvailable) {
    $flowSwitch = if ($FullApp) { "-FullApp " } elseif ($FastSmoke) { "-FastSmoke " } else { "" }
    $nextReplayCommand = ".\scripts\run-agent-device-fix-loop.ps1 ${flowSwitch}-Auto -SkipSeed -Iteration $($Iteration + 1)"
    Write-Host "Re-run after fix (auto build/replay): $nextReplayCommand"
} else {
    $flowSwitch = if ($FullApp) { "-FullApp " } elseif ($FastSmoke) { "-FastSmoke " } else { "" }
    $nextBuildCommand = ".\scripts\run-agent-device-fix-loop.ps1 ${flowSwitch}-Auto -SkipSeed -Iteration $($Iteration + 1)"
    Write-Host "Re-run after fix: $nextBuildCommand"
}
exit 1
