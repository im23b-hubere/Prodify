# Ensure the Maestro / agent-device smoke-test account exists on the target API (idempotent).
# Usage:
#   .\scripts\seed-e2e-user.ps1
#   .\scripts\seed-e2e-user.ps1 -ApiUrl "https://prodify-api-46b1.onrender.com"

param(
    [string]$ApiUrl = $(if ($env:E2E_API_URL) { $env:E2E_API_URL } else { "https://prodify-api-46b1.onrender.com" }),
    [string]$Email = $(if ($env:E2E_TEST_EMAIL) { $env:E2E_TEST_EMAIL } else { "test@prodify.app" }),
    [string]$Password = $(if ($env:E2E_TEST_PASSWORD) { $env:E2E_TEST_PASSWORD } else { "Test1234!" }),
    [string]$Username = $(if ($env:E2E_TEST_USERNAME) { $env:E2E_TEST_USERNAME } else { "e2euser" })
)

$ErrorActionPreference = "Stop"
$ApiUrl = $ApiUrl.TrimEnd("/")

Write-Host "Seeding E2E user at $ApiUrl ($Email / $Username)"

$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress

try {
    $login = Invoke-WebRequest -Uri "$ApiUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
    if ($login.StatusCode -eq 200) {
        Write-Host "E2E user login verified (existing account)."
        exit 0
    }
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "Login returned HTTP $status; attempting register..."
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
}

$registerBody = @{ email = $Email; password = $Password; username = $Username } | ConvertTo-Json -Compress
try {
    $register = Invoke-WebRequest -Uri "$ApiUrl/auth/register" -Method POST -ContentType "application/json" -Body $registerBody -UseBasicParsing
    Write-Host "Registered new E2E user (HTTP $($register.StatusCode))."
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -in 400, 409) {
        Write-Host "Register returned HTTP $status (account may already exist)."
    } else {
        Write-Host "Register failed with HTTP $status"
        if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
        exit 1
    }
}

try {
    $verify = Invoke-WebRequest -Uri "$ApiUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
    if ($verify.StatusCode -eq 200) {
        Write-Host "E2E user login verified."
        exit 0
    }
    Write-Host "Login smoke check failed with HTTP $($verify.StatusCode)"
    exit 1
} catch {
    Write-Host "Login smoke check failed:"
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    Write-Host "If the account exists with a different password, reset credentials or pass -Password."
    exit 1
}
