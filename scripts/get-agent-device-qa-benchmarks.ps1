# Summarize recent agent-device iOS QA workflow timings from GitHub Actions.
#
# Usage:
#   .\scripts\get-agent-device-qa-benchmarks.ps1
#   .\scripts\get-agent-device-qa-benchmarks.ps1 -Limit 20 -OutDir artifacts\qa-benchmarks

param(
    [int]$Limit = 15,
    [string]$WorkflowFile = "agent-device-ios.yml",
    [string]$Repo = "im23b-hubere/Prodify",
    [string]$OutDir = "artifacts\qa-benchmarks"
)

$ErrorActionPreference = "Stop"
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
        if (Test-Path $path) { return $path }
    }

    throw "GitHub CLI (gh) not found. Run: .\scripts\setup-gh.ps1"
}

Set-Location $RepoRoot
$Gh = Resolve-GhCommand
$resolvedOutDir = Join-Path $RepoRoot $OutDir
New-Item -ItemType Directory -Force -Path $resolvedOutDir | Out-Null

$runs = & $Gh run list --workflow $WorkflowFile --limit $Limit --json databaseId,status,conclusion,createdAt,updatedAt,headSha,url |
    ConvertFrom-Json

$stepRows = @()
$runRows = foreach ($run in $runs) {
    $createdAt = [datetime]$run.createdAt
    $updatedAt = [datetime]$run.updatedAt
    $durationMinutes = if ($run.status -eq "completed") {
        [math]::Round(($updatedAt - $createdAt).TotalMinutes, 2)
    } else {
        $null
    }

    $jobs = & $Gh api "repos/$Repo/actions/runs/$($run.databaseId)/jobs" --paginate | ConvertFrom-Json
    foreach ($job in $jobs.jobs) {
        foreach ($step in $job.steps) {
            if (-not $step.started_at -or -not $step.completed_at) { continue }

            $start = [datetime]$step.started_at
            $end = [datetime]$step.completed_at
            $stepRows += [pscustomobject]@{
                runId      = [string]$run.databaseId
                job        = $job.name
                step       = $step.name
                conclusion = $step.conclusion
                seconds    = [math]::Round(($end - $start).TotalSeconds, 1)
            }
        }
    }

    [pscustomobject]@{
        runId           = [string]$run.databaseId
        status          = $run.status
        conclusion      = $run.conclusion
        durationMinutes = $durationMinutes
        headSha         = $run.headSha
        url             = $run.url
    }
}

$stepSummary = $stepRows |
    Group-Object step |
    ForEach-Object {
        $values = @($_.Group | Where-Object { $_.seconds -gt 0 } | Select-Object -ExpandProperty seconds)
        if ($values.Count -eq 0) { return }

        [pscustomobject]@{
            step         = $_.Name
            samples      = $values.Count
            avgMinutes   = [math]::Round((($values | Measure-Object -Average).Average) / 60, 2)
            maxMinutes   = [math]::Round((($values | Measure-Object -Maximum).Maximum) / 60, 2)
            totalMinutes = [math]::Round((($values | Measure-Object -Sum).Sum) / 60, 2)
        }
    } |
    Sort-Object totalMinutes -Descending

$jsonPath = Join-Path $resolvedOutDir "agent-device-qa-benchmarks.json"
[pscustomobject]@{
    generatedAt = (Get-Date).ToString("o")
    workflow    = $WorkflowFile
    runs        = $runRows
    steps       = $stepSummary
} | ConvertTo-Json -Depth 6 | Set-Content -Path $jsonPath -Encoding UTF8

$markdownPath = Join-Path $resolvedOutDir "agent-device-qa-benchmarks.md"
$lines = @(
    "# agent-device iOS QA benchmarks",
    "",
    "- Generated: $(Get-Date -Format o)",
    "- Workflow: $WorkflowFile",
    "- Runs requested: $Limit",
    "",
    "## Step hotspots",
    "",
    "| Step | Samples | Avg | Max | Total |",
    "| --- | ---: | ---: | ---: | ---: |"
)

foreach ($step in $stepSummary) {
    $lines += "| $($step.step) | $($step.samples) | $($step.avgMinutes) min | $($step.maxMinutes) min | $($step.totalMinutes) min |"
}

$lines += "", "## Runs", "", "| Run | Result | Duration | URL |", "| --- | --- | ---: | --- |"
foreach ($run in $runRows) {
    $duration = if ($null -eq $run.durationMinutes) { "in progress" } else { "$($run.durationMinutes) min" }
    $result = if ([string]::IsNullOrWhiteSpace($run.conclusion)) { $run.status } else { $run.conclusion }
    $lines += "| $($run.runId) | $result | $duration | $($run.url) |"
}

$lines | Set-Content -Path $markdownPath -Encoding UTF8

Write-Host "Wrote benchmark JSON: $jsonPath"
Write-Host "Wrote benchmark report: $markdownPath"
