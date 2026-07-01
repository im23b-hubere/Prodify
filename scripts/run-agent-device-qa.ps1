# Trigger Prodify iOS agent-device QA on GitHub Actions (macOS runner).
# Use this from Windows - local iOS Simulator is not available.
#
# Usage:
#   .\scripts\run-agent-device-qa.ps1
#   .\scripts\run-agent-device-qa.ps1 -Watch
#   .\scripts\run-agent-device-qa.ps1 -FullApp -Watch
#   .\scripts\run-agent-device-qa.ps1 -Flow "maestro/flows/onboarding_to_login.yaml"
#   .\scripts\run-agent-device-qa.ps1 -FullApp -ReplayOnly -AppArtifactRunId 123456789 -Watch
#   .\scripts\run-agent-device-qa.ps1 -FastSmoke -Auto -Watch

param(
    [string]$ApiUrl = "https://prodify-api-46b1.onrender.com",
    [string]$TestEmail = "test@prodify.app",
    [string]$TestPassword = "Test1234!",
    [string]$TestUsername = "e2euser",
    [string]$Flow = "maestro/flows/smoke_test.yaml",
    [string]$AppArtifactRunId,
    [switch]$FullApp,
    [switch]$FastSmoke,
    [switch]$Auto,
    [switch]$ReplayOnly,
    [switch]$SkipSeed,
    [switch]$Watch,
    [switch]$DownloadArtifacts
)

$ErrorActionPreference = "Stop"
$WorkflowFile = "agent-device-ios.yml"
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Resolve-GhCommand {
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if ($gh) { return $gh.Source }

    $candidates = @(
        "$env:ProgramFiles\GitHub CLI\gh.exe",
        "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe",
        "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
    )

    foreach ($path in $candidates) {
        if (Test-Path $path) {
            $ghDir = Split-Path -Parent $path
            if ($env:Path -notlike "*$ghDir*") {
                $env:Path = "$env:Path;$ghDir"
            }
            return $path
        }
    }

    throw "GitHub CLI (gh) not found. Run: .\scripts\setup-gh.ps1"
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

if ($FullApp) {
    $Flow = "maestro/flows/full_app_test.yaml"
}
if ($FastSmoke) {
    $Flow = "maestro/flows/bootstrap_dashboard.yaml"
}

$Gh = Resolve-GhCommand
Set-Location $RepoRoot

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

Write-Host "Using gh: $Gh"
Write-Host "Checking gh authentication..."

$authCheck = & $Gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $authCheck
    throw "Not logged in. Run: & `"$Gh`" auth login"
}

if (-not $SkipSeed) {
    Write-Host ""
    Write-Host "Seeding E2E API user..."
    & "$PSScriptRoot\seed-e2e-user.ps1" -ApiUrl $ApiUrl -Email $TestEmail -Password $TestPassword -Username $TestUsername
}

Write-Host ""
Write-Host "Maestro flow: $Flow"
Write-Host "QA mode:      $QaMode"
if ($Auto) {
    Write-Host "Auto mode:    enabled"
}
if ($ReplayOnly) {
    Write-Host "App artifact: previous run $AppArtifactRunId"
}
Write-Host "Triggering workflow: $WorkflowFile"
& $Gh workflow run $WorkflowFile `
    -f "api_url=$ApiUrl" `
    -f "test_email=$TestEmail" `
    -f "test_password=$TestPassword" `
    -f "test_username=$TestUsername" `
    -f "maestro_flow=$Flow" `
    -f "qa_mode=$QaMode" `
    -f "app_artifact_run_id=$AppArtifactRunId" `
    -f "seed_api_user=$SeedApiUser"

if ($LASTEXITCODE -ne 0) {
    throw "Failed to trigger workflow. Is '$WorkflowFile' pushed to GitHub?"
}

Start-Sleep -Seconds 3
$runId = & $Gh run list --workflow=$WorkflowFile --limit 1 --json databaseId -q ".[0].databaseId"
$runUrl = & $Gh run view $runId --json url -q ".url"

Write-Host ""
Write-Host "Workflow started."
Write-Host "Run ID: $runId"
Write-Host "URL:    $runUrl"

if ($Watch) {
    Write-Host ""
    Write-Host "Watching run (Ctrl+C to detach)..."
    & $Gh run watch $runId
    & $Gh run view $runId
}

if ($DownloadArtifacts) {
    if (-not $Watch) {
        Write-Host ""
        Write-Host "Waiting for run to finish before downloading artifacts..."
        & $Gh run watch $runId
    }
    $dest = Join-Path $RepoRoot "artifacts\agent-device-ios-download"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Write-Host "Downloading artifacts to $dest"
    & $Gh run download $runId -D $dest
    Write-Host "Done."
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "  Open the run URL above in your browser"
Write-Host "  Watch locally:     & `"$Gh`" run watch $runId"
Write-Host "  Download artifacts: .\scripts\run-agent-device-qa.ps1 -SkipSeed -DownloadArtifacts"
Write-Host "  Replay same app:   .\scripts\run-agent-device-qa.ps1 -FullApp -ReplayOnly -AppArtifactRunId $runId -SkipSeed -Watch"
Write-Host "  Docs: docs/qa/agent-device-setup.md"
