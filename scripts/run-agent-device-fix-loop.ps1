# One agent-device QA iteration for the fix loop (test -> diagnose -> fix -> retest).
# Designed for Cursor Agent: run repeatedly until exit code 0.
#
# Auto mode is ON by default: reuses the last ios-simulator-app artifact when only
# Maestro/scripts changed (~5-10 min). Use -Staged with -FullApp for fast smoke then full coverage.

param(
    [switch]$FullApp,
    [switch]$FastSmoke,
    [switch]$Staged,
    [switch]$SkipSeed,
    [switch]$NoAuto,
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
. (Join-Path $PSScriptRoot "qa\Resolve-AgentDeviceQaMode.ps1")

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

function Write-SuccessReport {
    param(
        [string]$Path,
        [int]$Iteration,
        [string]$RunUrl,
        [string]$Flow,
        [string]$Conclusion,
        [string]$DownloadDir,
        [string[]]$VideoPaths,
        [string]$StageNote = ""
    )
    $lines = @(
        "# agent-device QA - SUCCESS (iteration $Iteration)",
        "",
        "- Run: $RunUrl",
        "- Flow: $Flow",
        "- Conclusion: $Conclusion"
    )
    if ($StageNote) {
        $lines += "- Stage: $StageNote"
    }
    $lines += @(
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
        [string]$ReplayAppArtifactRunId,
        [string]$StageNote = ""
    )
    $next = $Iteration + 1
    $flowSwitch = if ($FullApp) { "-FullApp " } elseif ($FastSmoke) { "-FastSmoke " } else { "" }
    $stagedSwitch = if ($Staged) { "-Staged " } else { "" }
    $rerunCommand = ".\scripts\run-agent-device-fix-loop.ps1 ${flowSwitch}${stagedSwitch}-SkipSeed -Iteration $next"
    $lines = @(
        "# agent-device QA - FAILURE (iteration $Iteration)",
        "",
        "- Run: $RunUrl",
        "- Run ID: $RunId",
        "- Flow: $Flow",
        "- Status: $Status",
        "- Conclusion: $Conclusion",
        "- Replay app artifact available: $AppArtifactAvailable"
    )
    if ($StageNote) {
        $lines += "- Stage: $StageNote"
    }
    $lines += @(
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

function Invoke-AgentDeviceQaRun {
    param(
        [string]$Gh,
        [string]$WorkflowFile,
        [string]$Flow,
        [string]$ApiUrl,
        [bool]$Auto,
        [switch]$ReplayOnly,
        [string]$AppArtifactRunId,
        [bool]$SkipSeed,
        [int]$Iteration
    )

    $resolution = Resolve-AgentDeviceQaMode -Gh $Gh -WorkflowFile $WorkflowFile `
        -Auto:$Auto -ReplayOnly:$ReplayOnly -AppArtifactRunId $AppArtifactRunId

    $QaMode = $resolution.QaMode
    $artifactRunId = $resolution.AppArtifactRunId

    if ($QaMode -eq "replay-only" -and [string]::IsNullOrWhiteSpace($artifactRunId)) {
        throw "Replay-only requires a reusable ios-simulator-app artifact. Run build-and-test once first."
    }

    $seedApiUser = if ($SkipSeed -or $QaMode -eq "replay-only") { "false" } else { "true" }
    if (-not $SkipSeed -and $Iteration -eq 1 -and $QaMode -eq "build-and-test") {
        & "$PSScriptRoot\seed-e2e-user.ps1" -ApiUrl $ApiUrl
    }

    Write-Host ""
    Write-AgentDeviceQaModeSummary -Resolution $resolution -Flow $Flow
    Write-Host "Triggering CI..."

    & $Gh workflow run $WorkflowFile `
        -f "api_url=$ApiUrl" `
        -f "maestro_flow=$Flow" `
        -f "qa_mode=$QaMode" `
        -f "app_artifact_run_id=$artifactRunId" `
        -f "seed_api_user=$seedApiUser"

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to trigger workflow $WorkflowFile"
    }

    Start-Sleep -Seconds 4
    $runId = & $Gh run list --workflow=$WorkflowFile --limit 1 --json databaseId -q ".[0].databaseId"
    $runUrl = & $Gh run view $runId --json url -q ".url"

    Write-Host "Run ID: $runId"
    Write-Host "URL:    $runUrl"
    if ($QaMode -eq "replay-only") {
        Write-Host "Waiting for CI (~5-10 min)..."
    } else {
        Write-Host "Waiting for CI (~25-35 min for build + test)..."
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

    return [pscustomobject]@{
        RunId = $runId
        RunUrl = $runUrl
        Conclusion = $conclusion
        Status = $status
        QaMode = $QaMode
        AppArtifactRunId = $artifactRunId
        Resolution = $resolution
    }
}

Set-Location $RepoRoot
$Gh = Resolve-GhCommand
$WorkflowFile = "agent-device-ios.yml"
$Auto = -not $NoAuto

$primaryFlow = if ($FullApp) {
    "maestro/flows/full_app_test.yaml"
} elseif ($FastSmoke) {
    "maestro/flows/bootstrap_dashboard.yaml"
} else {
    "maestro/flows/smoke_test.yaml"
}

Write-Host ""
Write-Host "=== agent-device QA iteration $Iteration ==="

if ($Staged -and $FullApp) {
    Write-Host "Staged mode: FastSmoke gate, then FullApp"
    $smokeResult = Invoke-AgentDeviceQaRun -Gh $Gh -WorkflowFile $WorkflowFile `
        -Flow "maestro/flows/bootstrap_dashboard.yaml" -ApiUrl $ApiUrl -Auto:$Auto `
        -ReplayOnly:$ReplayOnly -AppArtifactRunId $AppArtifactRunId -SkipSeed:$true -Iteration $Iteration

    if ($smokeResult.Conclusion -ne "success") {
        $failedLog = Get-FailedStepLog -Gh $Gh -RunId $smokeResult.RunId
        New-Item -ItemType Directory -Force -Path $IterDir | Out-Null
        if (Test-Path $LatestDir) { Remove-Item -Recurse -Force $LatestDir }
        New-Item -ItemType Directory -Force -Path $LatestDir | Out-Null
        $downloadDir = Join-Path $IterDir "ci-artifacts"
        New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
        try { & $Gh run download $smokeResult.RunId -D $downloadDir 2>&1 | Out-Null } catch {}
        Copy-Item -Recurse -Force $IterDir\* $LatestDir\
        $reportPath = Join-Path $LatestDir "report.md"
        Write-FailureReport -Path $reportPath -Iteration $Iteration -RunUrl $smokeResult.RunUrl `
            -Flow "maestro/flows/bootstrap_dashboard.yaml" -RunId $smokeResult.RunId `
            -Status $smokeResult.Status -Conclusion $smokeResult.Conclusion -DownloadDir $downloadDir `
            -FailedLog $failedLog -AppArtifactAvailable $true -ReplayAppArtifactRunId $smokeResult.RunId `
            -StageNote "FastSmoke gate failed; FullApp skipped"
        Write-Host "FAILURE at FastSmoke gate."
        exit 1
    }

    Write-Host ""
    Write-Host "FastSmoke passed. Running FullApp..."
    $fullResult = Invoke-AgentDeviceQaRun -Gh $Gh -WorkflowFile $WorkflowFile `
        -Flow "maestro/flows/full_app_test.yaml" -ApiUrl $ApiUrl -Auto:$Auto `
        -SkipSeed:$true -Iteration $Iteration

    $runId = $fullResult.RunId
    $runUrl = $fullResult.RunUrl
    $conclusion = $fullResult.Conclusion
    $status = $fullResult.Status
    $primaryFlow = "maestro/flows/full_app_test.yaml"
    $stageNote = "FastSmoke passed; FullApp $($fullResult.Conclusion)"
} else {
    $result = Invoke-AgentDeviceQaRun -Gh $Gh -WorkflowFile $WorkflowFile `
        -Flow $primaryFlow -ApiUrl $ApiUrl -Auto:$Auto `
        -ReplayOnly:$ReplayOnly -AppArtifactRunId $AppArtifactRunId `
        -SkipSeed:($SkipSeed -or $Iteration -gt 1) -Iteration $Iteration

    $runId = $result.RunId
    $runUrl = $result.RunUrl
    $conclusion = $result.Conclusion
    $status = $result.Status
    $stageNote = ""
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

if ($conclusion -eq "success") {
    $videoPaths = @(
        Get-ChildItem -Path $downloadDir -Recurse -Filter "*.mp4" -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName }
    )
    Write-SuccessReport -Path $reportPath -Iteration $Iteration -RunUrl $runUrl -Flow $primaryFlow `
        -Conclusion $conclusion -DownloadDir $downloadDir -VideoPaths $videoPaths -StageNote $stageNote
    Write-Host ""
    Write-Host "SUCCESS - iteration $Iteration passed."
    Write-Host "Report: $reportPath"
    exit 0
}

Write-FailureReport -Path $reportPath -Iteration $Iteration -RunUrl $runUrl -Flow $primaryFlow `
    -RunId $runId -Status $status -Conclusion $conclusion -DownloadDir $downloadDir -FailedLog $failedLog `
    -AppArtifactAvailable $appArtifactAvailable -ReplayAppArtifactRunId $runId -StageNote $stageNote

Write-Host ""
Write-Host "FAILURE - iteration $Iteration failed."
Write-Host "Report: $reportPath"
Write-Host ""
$flowSwitch = if ($FullApp) { "-FullApp " } elseif ($FastSmoke) { "-FastSmoke " } else { "" }
$stagedSwitch = if ($Staged) { "-Staged " } else { "" }
$nextCommand = ".\scripts\run-agent-device-fix-loop.ps1 ${flowSwitch}${stagedSwitch}-SkipSeed -Iteration $($Iteration + 1)"
Write-Host "Re-run after fix (auto build/replay): $nextCommand"
exit 1
