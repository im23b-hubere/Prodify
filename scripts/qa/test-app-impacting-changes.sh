#!/usr/bin/env bash
# Exit 0 when replay-only is safe (no app-impacting changes between commits).
# Exit 1 when a fresh app build is required.
set -euo pipefail

BASE_SHA="${1:-}"
HEAD_SHA="${2:-${GITHUB_SHA:-}}"

if [[ -z "$BASE_SHA" || -z "$HEAD_SHA" ]]; then
  echo "Usage: test-app-impacting-changes.sh <artifact_head_sha> [current_head_sha]"
  exit 2
fi

if [[ "$BASE_SHA" == "$HEAD_SHA" ]]; then
  echo "Replay safe: artifact matches current commit."
  exit 0
fi

APP_IMPACTING_PREFIXES=(
  "mobile/app/"
  "mobile/assets/"
  "mobile/components/"
  "mobile/constants/"
  "mobile/context/"
  "mobile/features/"
  "mobile/hooks/"
  "mobile/lib/"
  "mobile/types/"
  "mobile/plugins/"
  "mobile/ios/"
)

APP_IMPACTING_FILES=(
  "mobile/app.json"
  "mobile/eas.json"
  "mobile/package.json"
  "mobile/package-lock.json"
  "mobile/babel.config.js"
  "mobile/metro.config.js"
  "mobile/tsconfig.json"
)

is_app_impacting() {
  local file="$1"
  local exact
  for exact in "${APP_IMPACTING_FILES[@]}"; do
    if [[ "$file" == "$exact" ]]; then
      return 0
    fi
  done
  local prefix
  for prefix in "${APP_IMPACTING_PREFIXES[@]}"; do
    if [[ "$file" == "$prefix"* ]]; then
      return 0
    fi
  done
  return 1
}

CHANGED_FILES=()
while IFS= read -r file; do
  [[ -n "$file" ]] && CHANGED_FILES+=("$file")
done < <(git diff --name-only "$BASE_SHA..$HEAD_SHA" 2>/dev/null || true)
if [[ "${#CHANGED_FILES[@]}" -eq 0 ]]; then
  echo "Replay safe: no file changes between commits."
  exit 0
fi

for file in "${CHANGED_FILES[@]}"; do
  if is_app_impacting "$file"; then
    echo "Fresh build required: app-impacting change in $file"
    exit 1
  fi
done

echo "Replay safe: only Maestro/scripts/docs changed."
exit 0
