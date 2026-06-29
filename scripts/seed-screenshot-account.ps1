# Seed realistic screenshot data for eric.huber.ch@gmail.com.
# Usage (local SQLite):
#   .\scripts\seed-screenshot-account.ps1 -MainPassword "your-password"
#
# Production API (Render):
#   $env:INTERNAL_JOB_KEY = "<from Render dashboard>"
#   .\scripts\seed-screenshot-account.ps1 -ViaApi -MainPassword "your-password"

param(
    [switch]$ViaApi,
    [string]$ApiUrl = $(if ($env:API_URL) { $env:API_URL } else { "https://prodify-api-46b1.onrender.com" }),
    [string]$InternalJobKey = $env:INTERNAL_JOB_KEY,
    [string]$MainEmail = "eric.huber.ch@gmail.com",
    [string]$MainUsername = "erix",
    [string]$MainPassword = "demo123456",
    [int]$DaysBack = 120,
    [int]$CurrentStreak = 64,
    [int]$LongestStreak = 89,
    [int]$MainLevel = 28
)

$ErrorActionPreference = "Stop"

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
        throw "Set INTERNAL_JOB_KEY (Render env) or pass -InternalJobKey."
    }
    $uri = "$($ApiUrl.TrimEnd('/'))/jobs/seed-screenshot-account"
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers @{
        "X-Internal-Job-Key" = $InternalJobKey
        "Content-Type"       = "application/json"
    } -Body $seedBody
    $response | ConvertTo-Json -Depth 5
    exit 0
}

Push-Location (Join-Path $PSScriptRoot "..\backend")
try {
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
