#!/usr/bin/env bash
set -euo pipefail

# Database backup script.
# Supports PostgreSQL URLs via pg_dump and SQLite URLs via Python stdlib.

DATE="$(date +%Y%m%d_%H%M%S)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$BACKEND_DIR/backups"
DATABASE_URL="${DATABASE_URL:-}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

if [[ "$DATABASE_URL" == sqlite:* ]]; then
  BACKUP_FILE="$BACKUP_DIR/prodify_${DATE}.sqlite3"
  export BACKUP_FILE DATABASE_URL
  python - <<'PY'
import os
import shutil
from urllib.parse import unquote, urlparse

database_url = os.environ["DATABASE_URL"]
parsed = urlparse(database_url)
path = unquote(parsed.path or "")

sqlite_path = path
if sqlite_path.startswith("/./"):
    sqlite_path = sqlite_path[1:]
elif sqlite_path.startswith("///"):
    sqlite_path = sqlite_path[2:]
elif sqlite_path.startswith("//"):
    sqlite_path = sqlite_path[1:]

if os.name == "nt" and len(sqlite_path) >= 3 and sqlite_path[0] == "/" and sqlite_path[2] == ":":
    sqlite_path = sqlite_path[1:]

if not sqlite_path:
    raise SystemExit("Unsupported sqlite DATABASE_URL")

backup_file = os.environ["BACKUP_FILE"]
shutil.copy2(sqlite_path, backup_file)
PY
  gzip -f "$BACKUP_FILE"
  echo "Backup created: ${BACKUP_FILE}.gz"
  exit 0
fi

BACKUP_FILE="$BACKUP_DIR/prodify_${DATE}.sql"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
gzip -f "$BACKUP_FILE"
echo "Backup created: ${BACKUP_FILE}.gz"
