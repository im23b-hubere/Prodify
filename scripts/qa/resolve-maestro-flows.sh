#!/usr/bin/env bash
# Print Maestro flow paths (relative to mobile/), one per line.
# Usage: resolve-maestro-flows.sh [suite] [single_flow]
#   suite: "none" (default) or a name matching mobile/maestro/suites/<name>.txt
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SUITE="${1:-none}"
SINGLE="${2:-maestro/flows/smoke_test.yaml}"
SUITE_DIR="${ROOT}/mobile/maestro/suites"

if [[ -z "$SUITE" || "$SUITE" == "none" ]]; then
  echo "$SINGLE"
  exit 0
fi

LIST="${SUITE_DIR}/${SUITE}.txt"
if [[ ! -f "$LIST" ]]; then
  echo "Unknown Maestro suite '${SUITE}' (missing ${LIST})" >&2
  exit 1
fi

grep -vE '^\s*(#|$)' "$LIST"
