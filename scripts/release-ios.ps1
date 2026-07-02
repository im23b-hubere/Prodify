# Fast iOS release path for App Store / TestFlight (Windows-friendly).
# Maestro CI is optional — EAS production build is what Apple receives.
#
# Usage:
#   .\scripts\release-ios.ps1 -Build              # Start EAS production build (~20-40 min)
#   .\scripts\release-ios.ps1 -Submit -BuildId <id>  # Submit finished build to App Store Connect
#   .\scripts\release-ios.ps1 -Build -SubmitLatest     # Build, then submit when done
#   .\scripts\release-ios.ps1 -PreflightOnly        # Check readiness without building

param(
    [switch]$Build,
    [switch]$Submit,
    [switch]$SubmitLatest,
    [switch]$PreflightOnly,
    [string]$BuildId,
    [switch]$SkipQa,
    [switch]$WaitForQa
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$MobileDir = Join-Path $RepoRoot "mobile"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message"
}

function Test-CommandExists([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-AppVersionInfo {
    $appJson = Get-Content (Join-Path $MobileDir "app.json") -Raw | ConvertFrom-Json
    return [pscustomobject]@{
        Version = [string]$appJson.expo.version
        IosBuildNumber = [string]$appJson.expo.ios.buildNumber
    }
}

function Invoke-Preflight {
    Write-Step "Preflight"
    if (-not (Test-Path $MobileDir)) {
        throw "mobile/ directory not found."
    }

    $version = Get-AppVersionInfo
    Write-Host "App version: $($version.Version) (local ios.buildNumber=$($version.IosBuildNumber))"
    Write-Host "EAS production uses remote autoIncrement — build number comes from Expo servers."

    if (-not (Test-CommandExists "node")) {
        throw "Node.js is required."
    }

    Push-Location $MobileDir
    try {
        $whoami = npx eas whoami 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Not logged in to EAS. Run: cd mobile; npx eas login"
        }
        Write-Host "EAS account: $($whoami -join ' ')"
    } finally {
        Pop-Location
    }

    $dirty = git status --porcelain 2>$null
    if ($dirty) {
        Write-Host "Warning: uncommitted changes detected. Release builds should use a pushed commit."
        $dirty | Select-Object -First 8 | ForEach-Object { Write-Host "  $_" }
    }

    Write-Host ""
    Write-Host "Tonight checklist (App Store Connect):"
    Write-Host "  [ ] Screenshots uploaded"
    Write-Host "  [ ] Privacy / age rating / encryption questionnaire"
    Write-Host "  [ ] Paid Apps Agreement active"
    Write-Host "  [ ] IAP products linked to version $($version.Version)"
    Write-Host "  [ ] Release notes ready"
}

function Start-OptionalQa {
    if ($SkipQa) {
        Write-Host "Skipping Maestro QA (release path)."
        return
    }

    Write-Step "Triggering fast Maestro QA (non-blocking unless -WaitForQa)"
    & "$PSScriptRoot\run-agent-device-qa.ps1" -FastSmoke -SkipSeed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: could not trigger QA workflow."
        return
    }

    if ($WaitForQa) {
        Write-Host "Waiting for QA — this can take 5-10 min..."
        Start-Sleep -Seconds 5
        $runId = & gh run list --workflow=agent-device-ios.yml --limit 1 --json databaseId -q ".[0].databaseId"
        & gh run watch $runId
    } else {
        Write-Host "QA triggered in background. Check GitHub Actions while EAS builds."
    }
}

function Start-EasBuild {
    Write-Step "Starting EAS production iOS build"
    Write-Host "This usually takes 20-40 minutes on Expo cloud servers."
    Write-Host "Track progress: https://expo.dev/accounts/erix_h/projects/prodify/builds"
    Write-Host ""

    Push-Location $MobileDir
    try {
        npx eas build --platform ios --profile production --non-interactive
        if ($LASTEXITCODE -ne 0) {
            throw "EAS build failed."
        }
    } finally {
        Pop-Location
    }
}

function Start-EasSubmit {
    param([string]$Id)

    Write-Step "Submitting to App Store Connect"
    Push-Location $MobileDir
    try {
        if ($SubmitLatest) {
            npx eas submit --platform ios --profile production --latest --non-interactive
        } elseif ($Id) {
            npx eas submit --platform ios --profile production --id $Id --non-interactive
        } else {
            throw "Pass -BuildId <uuid> or -SubmitLatest."
        }
        if ($LASTEXITCODE -ne 0) {
            throw "EAS submit failed."
        }
    } finally {
        Pop-Location
    }
}

Set-Location $RepoRoot
Invoke-Preflight

if ($PreflightOnly) {
    exit 0
}

if (-not ($Build -or $Submit -or $SubmitLatest)) {
    Write-Host ""
    Write-Host "Nothing to do. Examples:"
    Write-Host "  .\scripts\release-ios.ps1 -Build -SkipQa"
    Write-Host "  .\scripts\release-ios.ps1 -SubmitLatest"
    exit 0
}

if ($Build) {
    Start-OptionalQa
    Start-EasBuild
}

if ($Submit -or $SubmitLatest) {
    Start-EasSubmit -Id $BuildId
}

Write-Step "Done"
Write-Host "Next: install TestFlight build on iPhone, smoke-test login/session/paywall, then submit for review in App Store Connect."
