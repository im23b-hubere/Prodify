# Shared QA mode resolution for agent-device iOS workflows.
# Dot-source from run-agent-device-qa.ps1 and run-agent-device-fix-loop.ps1.

$script:AppImpactingPrefixes = @(
    "mobile/app/",
    "mobile/assets/",
    "mobile/components/",
    "mobile/constants/",
    "mobile/context/",
    "mobile/features/",
    "mobile/hooks/",
    "mobile/lib/",
    "mobile/types/",
    "mobile/plugins/",
    "mobile/ios/"
)

$script:AppImpactingFiles = @(
    "mobile/app.json",
    "mobile/eas.json",
    "mobile/package.json",
    "mobile/package-lock.json",
    "mobile/babel.config.js",
    "mobile/metro.config.js",
    "mobile/tsconfig.json"
)

function Test-RunArtifact {
    param(
        [string]$Gh,
        [string]$RunId,
        [string]$Name
    )

    try {
        $artifacts = & $Gh api "repos/im23b-hubere/Prodify/actions/runs/$RunId/artifacts" 2>$null | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0 -or -not $artifacts) { return $false }
        return @($artifacts.artifacts | Where-Object { $_.name -eq $Name -and -not $_.expired }).Count -gt 0
    } catch {
        return $false
    }
}

function Get-AppImpactingChangedFiles {
    param([string]$BaseSha)

    if ([string]::IsNullOrWhiteSpace($BaseSha)) {
        return @("*")
    }

    $headSha = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($headSha)) {
        return @("*")
    }

    if ($headSha -eq $BaseSha) {
        return @()
    }

    $changedFiles = @(git diff --name-only "$BaseSha..HEAD" 2>$null)
    if ($LASTEXITCODE -ne 0) {
        return @("*")
    }

    $impacting = @()
    foreach ($file in $changedFiles) {
        $normalized = $file.Replace("\", "/")
        if ($script:AppImpactingFiles -contains $normalized) {
            $impacting += $normalized
            continue
        }
        foreach ($prefix in $script:AppImpactingPrefixes) {
            if ($normalized.StartsWith($prefix)) {
                $impacting += $normalized
                break
            }
        }
    }

    return $impacting
}

function Test-NeedsFreshAppBuild {
    param([string]$BaseSha)

    return (Get-AppImpactingChangedFiles -BaseSha $BaseSha).Count -gt 0
}

function Get-LatestRunWithArtifact {
    param(
        [string]$Gh,
        [string]$WorkflowFile,
        [string]$ArtifactName = "ios-simulator-app"
    )

    $runs = & $Gh run list --workflow=$WorkflowFile --limit 30 --json databaseId,status,conclusion,headSha,createdAt |
        ConvertFrom-Json

    foreach ($run in $runs) {
        if ($run.status -ne "completed") { continue }

        $runId = [string]$run.databaseId
        if (Test-RunArtifact -Gh $Gh -RunId $runId -Name $ArtifactName) {
            return [pscustomobject]@{
                RunId = $runId
                HeadSha = [string]$run.headSha
                Conclusion = [string]$run.conclusion
            }
        }
    }

    return $null
}

function Resolve-AgentDeviceQaMode {
    param(
        [string]$Gh,
        [string]$WorkflowFile = "agent-device-ios.yml",
        [switch]$Auto,
        [switch]$ReplayOnly,
        [string]$AppArtifactRunId
    )

    $result = [ordered]@{
        QaMode = if ($ReplayOnly) { "replay-only" } else { "build-and-test" }
        AppArtifactRunId = $AppArtifactRunId
        AutoEnabled = [bool]$Auto
        AutoReason = "manual"
        NeedsFreshBuild = $true
        ChangedAppFiles = @()
        ArtifactRunId = $null
        ArtifactHeadSha = $null
    }

    if ($Auto) {
        $latestArtifact = Get-LatestRunWithArtifact -Gh $Gh -WorkflowFile $WorkflowFile
        if ($latestArtifact) {
            $result.ArtifactRunId = $latestArtifact.RunId
            $result.ArtifactHeadSha = $latestArtifact.HeadSha
            $changedAppFiles = @(Get-AppImpactingChangedFiles -BaseSha $latestArtifact.HeadSha)
            $result.ChangedAppFiles = $changedAppFiles
            $result.NeedsFreshBuild = $changedAppFiles.Count -gt 0

            if (-not $result.NeedsFreshBuild) {
                $result.QaMode = "replay-only"
                $result.AppArtifactRunId = $latestArtifact.RunId
                $result.AutoReason = "app unchanged since artifact run $($latestArtifact.RunId)"
            } else {
                $result.AutoReason = "app-impacting changes since artifact run $($latestArtifact.RunId)"
            }
        } else {
            $result.AutoReason = "no reusable ios-simulator-app artifact found"
        }
    } elseif ($ReplayOnly) {
        if ([string]::IsNullOrWhiteSpace($result.AppArtifactRunId)) {
            $latestArtifact = Get-LatestRunWithArtifact -Gh $Gh -WorkflowFile $WorkflowFile
            if ($latestArtifact) {
                $result.AppArtifactRunId = $latestArtifact.RunId
            }
        }
        $result.QaMode = "replay-only"
        $result.AutoReason = "replay-only requested explicitly"
    } else {
        $result.AutoReason = "build-and-test requested explicitly"
    }

    return [pscustomobject]$result
}

function Write-AgentDeviceQaModeSummary {
    param(
        [pscustomobject]$Resolution,
        [string]$Flow
    )

    Write-Host "Maestro flow: $Flow"
    Write-Host "QA mode:      $($Resolution.QaMode)"
    if ($Resolution.AutoEnabled) {
        Write-Host "Auto mode:    enabled ($($Resolution.AutoReason))"
    }
    if ($Resolution.QaMode -eq "replay-only") {
        Write-Host "App artifact: run $($Resolution.AppArtifactRunId)"
        Write-Host "Est. runtime: ~5-10 min"
    } else {
        Write-Host "Est. runtime: ~25-35 min (build + test)"
        if ($Resolution.ChangedAppFiles.Count -gt 0 -and $Resolution.ChangedAppFiles[0] -ne "*") {
            Write-Host "Rebuild due to:"
            $Resolution.ChangedAppFiles | Select-Object -First 8 | ForEach-Object { Write-Host "  - $_" }
            if ($Resolution.ChangedAppFiles.Count -gt 8) {
                Write-Host "  - ... and $($Resolution.ChangedAppFiles.Count - 8) more"
            }
        }
    }
}
