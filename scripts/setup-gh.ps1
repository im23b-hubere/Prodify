# Ensure GitHub CLI (gh) is on PATH and print next steps for agent-device QA.
# Run once if `gh` is not recognized in PowerShell.

$ghDir = "C:\Program Files\GitHub CLI"
$ghExe = Join-Path $ghDir "gh.exe"

if (-not (Test-Path $ghExe)) {
    Write-Host "GitHub CLI not found. Install with:"
    Write-Host "  winget install GitHub.cli"
    exit 1
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*GitHub CLI*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$ghDir", "User")
    $env:Path = "$env:Path;$ghDir"
    Write-Host "Added to user PATH: $ghDir"
} else {
    Write-Host "GitHub CLI already on user PATH."
}

& $ghExe --version

Write-Host ""
Write-Host "Next:"
Write-Host "  1. Login (works without terminal restart):"
Write-Host "       & `"$ghExe`" auth login"
Write-Host "  2. Full app test (no Mac — runs on GitHub Actions):"
Write-Host "       .\scripts\run-agent-device-qa.ps1 -FullApp -Watch"
Write-Host "  3. Fast smoke only:"
Write-Host "       .\scripts\run-agent-device-qa.ps1 -Watch"
