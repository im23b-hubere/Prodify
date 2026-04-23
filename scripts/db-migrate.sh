#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/db-migrate.sh head
#   ./scripts/db-migrate.sh +1
#   ./scripts/db-migrate.sh <revision>
TARGET_REVISION="${1:-head}"

echo "Applying migrations to revision: ${TARGET_REVISION}"
cd backend
python -m alembic upgrade "${TARGET_REVISION}"
echo "Migration completed."
