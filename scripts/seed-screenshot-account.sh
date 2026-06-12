#!/usr/bin/env bash
# Seed realistic screenshot data for eric.huber.ch@gmail.com on the target database.
#
# Local SQLite (backend/.env):
#   cd backend && python scripts/seed_rich_test_account.py
#
# Production PostgreSQL (Render external DB URL):
#   export DATABASE_URL='postgresql+psycopg://...'
#   export SECRET_KEY='...'   # any valid value for script import
#   cd backend && python scripts/seed_rich_test_account.py
#
# Production API (after deploy, requires INTERNAL_JOB_KEY on server):
#   curl -sS -X POST "$API_URL/jobs/seed-screenshot-account" \
#     -H "X-Internal-Job-Key: $INTERNAL_JOB_KEY"

set -euo pipefail
cd "$(dirname "$0")/../backend"
python scripts/seed_rich_test_account.py "$@"
