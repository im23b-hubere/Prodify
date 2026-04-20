#!/usr/bin/env bash
set -euo pipefail

echo "Deploying Prodify backend to production"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "main" ]]; then
  echo -e "${RED}Must be on main branch (current: $BRANCH)${NC}"
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo -e "${RED}Uncommitted changes detected${NC}"
  exit 1
fi

echo "Pulling latest changes..."
git pull origin main

echo "Running backend tests..."
cd backend
pytest --cov=app --cov-report=term-missing --cov-fail-under=70

echo -e "${YELLOW}Database backup: configure pg_dump or your host backup before uncommenting.${NC}"
# timestamp=$(date +%Y%m%d_%H%M%S)
# pg_dump "$DATABASE_URL" > "../backups/prod_${timestamp}.sql"

echo -e "${YELLOW}Run migrations against production (example): alembic upgrade head${NC}"
# alembic upgrade head

echo -e "${YELLOW}Deploy via your platform (Railway, Render, Docker, k8s, etc.)${NC}"

echo -e "${GREEN}Script finished. Verify health: https://api.prodify.app/health${NC}"
