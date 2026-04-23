param(
  [string]$TargetRevision = "head"
)

$ErrorActionPreference = "Stop"

Write-Host "Applying migrations to revision: $TargetRevision"
Push-Location "backend"
try {
  python -m alembic upgrade $TargetRevision
  Write-Host "Migration completed."
}
finally {
  Pop-Location
}
