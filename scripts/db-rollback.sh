#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/db-rollback.sh -1
#   ./scripts/db-rollback.sh base
#   ./scripts/db-rollback.sh <revision>
TARGET_REVISION="${1:--1}"

echo "Rolling back database to revision: ${TARGET_REVISION}"
cd backend
python -m alembic downgrade "${TARGET_REVISION}"
echo "Rollback completed."
