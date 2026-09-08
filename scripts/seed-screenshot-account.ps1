# Seed realistic screenshot data for a demo account.
#
# DESTRUCTIVE: resets the target account's password and deletes its sessions and friendships.
# Never point this at an account you actually use.
#
# Credentials have no defaults on purpose. Supply them explicitly:
#   .\scripts\seed-screenshot-account.ps1 -MainEmail "shots@example.com" -MainUsername "shots" -MainPassword "<12+ chars>"
#
# Production API (Render):
#   $env:INTERNAL_JOB_KEY = "<from Render dashboard>"
#   .\scripts\seed-screenshot-account.ps1 -ViaApi -MainEmail ... -MainUsername ... -MainPassword ...

param(
    [switch]$ViaApi,
    [string]$ApiUrl = $(if ($env:API_URL) { $env:API_URL } else { "https://prodify-api-46b1.onrender.com" }),
    [string]$InternalJobKey = $env:INTERNAL_JOB_KEY,
    [Parameter(Mandatory = $true)][string]$MainEmail,
    [Parameter(Mandatory = $true)][string]$MainUsername,
    [Parameter(Mandatory = $true)][string]$MainPassword,
    [string]$FriendPassword,
    [int]$DaysBack = 120,
    [int]$CurrentStreak = 64,
    [int]$LongestStreak = 89,
    [int]$MainLevel = 28
)

$ErrorActionPreference = "Stop"

if ($MainPassword.Length -lt 12) {
    throw "MainPassword must be at least 12 characters."
}
if (-not $FriendPassword) {
    $FriendPassword = $MainPassword
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
        --friend-password $FriendPassword `
        --days-back $DaysBack `
        --current-streak $CurrentStreak `
        --longest-streak $LongestStreak `
        --main-level $MainLevel
} finally {
    Pop-Location
}
