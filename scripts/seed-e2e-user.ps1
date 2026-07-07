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

function Wait-ApiWarm {
    param([int]$MaxAttempts = 6)
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $health = Invoke-WebRequest -Uri "$ApiUrl/health" -Method GET -UseBasicParsing -TimeoutSec 90
            if ($health.StatusCode -eq 200) {
                Write-Host "API health OK (attempt $attempt/$MaxAttempts)."
                return $true
            }
            Write-Host "API health HTTP $($health.StatusCode) (attempt $attempt/$MaxAttempts)."
        } catch {
            Write-Host "API health failed (attempt $attempt/$MaxAttempts): $($_.Exception.Message)"
        }
        if ($attempt -lt $MaxAttempts) {
            Start-Sleep -Seconds 15
        }
    }
    Write-Host "Warning: API warm-up did not return 200; continuing with login/register attempts."
    return $false
}

Wait-ApiWarm | Out-Null

$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress

function Stop-ActiveE2ESession {
    param([string]$Token)
    try {
        $active = Invoke-WebRequest -Uri "$ApiUrl/sessions/active" -Method GET -Headers @{ Authorization = "Bearer $Token" } -UseBasicParsing
        if ($active.StatusCode -ne 200) { return }
        $session = $active.Content | ConvertFrom-Json
        $stopBody = @{ session_id = $session.id } | ConvertTo-Json -Compress
        $stopped = Invoke-WebRequest -Uri "$ApiUrl/sessions/stop" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $Token" } -Body $stopBody -UseBasicParsing
        Write-Host "Stopped active E2E session $($session.id) (HTTP $($stopped.StatusCode))."
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 404) {
            Write-Host "No active E2E session to stop (HTTP 404)."
            return
        }
        Write-Host "Active session cleanup failed (HTTP $status)."
        if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    }
}

function Finalize-E2ELogin {
    param([string]$Content)
    $token = ($Content | ConvertFrom-Json).access_token
    Stop-ActiveE2ESession -Token $token
    Write-Host "E2E user login verified."
}

try {
    $login = Invoke-WebRequest -Uri "$ApiUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
    if ($login.StatusCode -eq 200) {
        Write-Host "E2E user login verified (existing account)."
        Finalize-E2ELogin -Content $login.Content
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
        Finalize-E2ELogin -Content $verify.Content
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
