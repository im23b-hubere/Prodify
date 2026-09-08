# Seed the Apple App Review demo account on production (or a local DB).
#
# DESTRUCTIVE: resets the target account's password and deletes its sessions and friendships.
#
# Credentials are never stored in this file. Supply them via environment variables so they
# stay out of the repository and out of your shell history:
#   $env:APPLE_REVIEW_EMAIL    = "apple.review@prodify.app"
#   $env:APPLE_REVIEW_PASSWORD = "<the password given to App Review>"
#
# Production API (recommended — uses Render PostgreSQL via the backend job):
#   .\scripts\seed-review-account.ps1 -ViaApi
#
# Local SQLite (backend/.env DATABASE_URL):
#   .\scripts\seed-review-account.ps1
#
# INTERNAL_JOB_KEY falls back to backend/.env when -ViaApi is used and the env var is unset.
# In CI, prefer the "Seed Apple review account" workflow, which reads repository secrets.

param(
    [switch]$ViaApi,
    [string]$ApiUrl = $(if ($env:API_URL) { $env:API_URL } else { "https://prodify-api-46b1.onrender.com" }),
    [string]$InternalJobKey = $env:INTERNAL_JOB_KEY,
    [string]$MainEmail = $env:APPLE_REVIEW_EMAIL,
    [string]$MainUsername = "prodifyreview",
    [string]$MainPassword = $env:APPLE_REVIEW_PASSWORD,
    [string]$FriendPassword = $env:APPLE_REVIEW_PASSWORD,
    [int]$DaysBack = 84,
    [int]$CurrentStreak = 64,
    [int]$LongestStreak = 71,
    [int]$MainLevel = 24
)

$ErrorActionPreference = "Stop"

if (-not $MainEmail) {
    throw "Set APPLE_REVIEW_EMAIL (or pass -MainEmail). This script has no default account on purpose."
}
if (-not $MainPassword -or $MainPassword.Length -lt 12) {
    throw "Set APPLE_REVIEW_PASSWORD to at least 12 characters (or pass -MainPassword)."
}
if (-not $FriendPassword) {
    $FriendPassword = $MainPassword
}

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
    friend_password  = $FriendPassword
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
        --friend-password $FriendPassword `
        --days-back $DaysBack `
        --current-streak $CurrentStreak `
        --longest-streak $LongestStreak `
        --main-level $MainLevel
} finally {
    Pop-Location
}
