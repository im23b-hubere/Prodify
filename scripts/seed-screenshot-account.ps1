# Seed realistic screenshot data for eric.huber.ch@gmail.com.
# Usage:
#   .\scripts\seed-screenshot-account.ps1
# Production API (after deploy):
#   $env:API_URL = "https://prodify-api-46b1.onrender.com"
#   $env:INTERNAL_JOB_KEY = "<from Render dashboard>"
#   .\scripts\seed-screenshot-account.ps1 -ViaApi

param(
    [switch]$ViaApi,
    [string]$ApiUrl = $(if ($env:API_URL) { $env:API_URL } else { "https://prodify-api-46b1.onrender.com" }),
    [string]$InternalJobKey = $env:INTERNAL_JOB_KEY
)

$ErrorActionPreference = "Stop"

if ($ViaApi) {
    if (-not $InternalJobKey) {
        throw "Set INTERNAL_JOB_KEY (Render env) or pass -InternalJobKey."
    }
    $uri = "$($ApiUrl.TrimEnd('/'))/jobs/seed-screenshot-account"
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers @{
        "X-Internal-Job-Key" = $InternalJobKey
    }
    $response | ConvertTo-Json -Depth 5
    exit 0
}

Push-Location (Join-Path $PSScriptRoot "..\backend")
try {
    python scripts/seed_rich_test_account.py @args
} finally {
    Pop-Location
}
