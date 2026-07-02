# Seed Apple App Review demo account on production (or local DB).
#
# Production API (recommended — uses Render PostgreSQL via backend job):
#   .\scripts\seed-review-account.ps1 -ViaApi
#   # or: $env:INTERNAL_JOB_KEY = "<Render dashboard>" then -ViaApi
#
# Local SQLite (backend/.env DATABASE_URL):
#   .\scripts\seed-review-account.ps1
#
# Loads INTERNAL_JOB_KEY from backend/.env when -ViaApi and env var is unset.

param(
    [switch]$ViaApi,
    [string]$ApiUrl = $(if ($env:API_URL) { $env:API_URL } else { "https://prodify-api-46b1.onrender.com" }),
    [string]$InternalJobKey = $env:INTERNAL_JOB_KEY,
    [string]$MainEmail = "apple.review@prodify.app",
    [string]$MainUsername = "prodifyreview",
    [string]$MainPassword = "ProdifyReview2026!",
    [int]$DaysBack = 84,
    [int]$CurrentStreak = 64,
    [int]$LongestStreak = 71,
    [int]$MainLevel = 24
)

$ErrorActionPreference = "Stop"

function Read-DotEnvValue {
    param([string]$Key, [string]$EnvFile)
    if (-not (Test-Path $EnvFile)) { return $null }
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=\s*(.+?)\s*$") {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

if ($ViaApi -and -not $InternalJobKey) {
    $envFile = Join-Path $PSScriptRoot "..\backend\.env"
    $InternalJobKey = Read-DotEnvValue -Key "INTERNAL_JOB_KEY" -EnvFile $envFile
}

$seedBody = @{
    main_email       = $MainEmail
    main_username    = $MainUsername
    main_password    = $MainPassword
    days_back        = $DaysBack
    current_streak   = $CurrentStreak
    longest_streak   = $LongestStreak
    main_level       = $MainLevel
} | ConvertTo-Json

if ($ViaApi) {
    if (-not $InternalJobKey) {
        throw "Set INTERNAL_JOB_KEY (Render env / backend/.env) or pass -InternalJobKey."
    }
    $uri = "$($ApiUrl.TrimEnd('/'))/jobs/seed-screenshot-account"
    Write-Host "Seeding review account at $uri ($MainEmail)..."
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers @{
        "X-Internal-Job-Key" = $InternalJobKey
        "Content-Type"       = "application/json"
    } -Body $seedBody
    $response | ConvertTo-Json -Depth 5
    exit 0
}

Push-Location (Join-Path $PSScriptRoot "..\backend")
try {
    Write-Host "Seeding review account locally ($MainEmail)..."
    python scripts/seed_rich_test_account.py `
        --main-email $MainEmail `
        --main-username $MainUsername `
        --main-password $MainPassword `
        --days-back $DaysBack `
        --current-streak $CurrentStreak `
        --longest-streak $LongestStreak `
        --main-level $MainLevel
} finally {
    Pop-Location
}
