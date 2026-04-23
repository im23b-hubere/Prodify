param(
  [string]$TargetRevision = "-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Rolling back database to revision: $TargetRevision"
Push-Location "backend"
try {
  python -m alembic downgrade $TargetRevision
  Write-Host "Rollback completed."
}
finally {
  Pop-Location
}
