#!/usr/bin/env bash
# Ensure the Maestro smoke-test account exists on the target API (idempotent).
set -euo pipefail

API_URL="${E2E_API_URL:-https://prodify-api-46b1.onrender.com}"
EMAIL="${E2E_TEST_EMAIL:-test@prodify.app}"
PASSWORD="${E2E_TEST_PASSWORD:-Test1234!}"
USERNAME="${E2E_TEST_USERNAME:-e2euser}"

API_URL="${API_URL%/}"

echo "Seeding E2E user at ${API_URL} (${EMAIL} / ${USERNAME})"

warm_api() {
  local attempt=1
  local max_attempts=6
  while [[ "$attempt" -le "$max_attempts" ]]; do
    local status
    status=$(curl -sS --max-time 90 -o /tmp/prodify-e2e-health.json -w "%{http_code}" \
      "${API_URL}/health" || true)
    if [[ "$status" == "200" ]]; then
      echo "API health OK (attempt ${attempt}/${max_attempts})."
      return 0
    fi
    echo "API health HTTP ${status} (attempt ${attempt}/${max_attempts}); retrying in 15s..."
    sleep 15
    attempt=$((attempt + 1))
  done
  echo "API health did not return 200 after ${max_attempts} attempts."
  cat /tmp/prodify-e2e-health.json 2>/dev/null || true
  return 1
}

warm_api || {
  echo "Warning: API warm-up failed; continuing with login/register attempts."
}

login_payload=$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")

read_access_token() {
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["access_token"])' "$1"
}

stop_active_session_if_needed() {
  local token="$1"
  local active_status
  active_status=$(curl -sS -o /tmp/prodify-e2e-active.json -w "%{http_code}" \
    -H "Authorization: Bearer ${token}" \
    "${API_URL}/sessions/active" || true)

  if [[ "$active_status" == "200" ]]; then
    local session_id
    session_id=$(python3 -c 'import json; print(json.load(open("/tmp/prodify-e2e-active.json"))["id"])')
    local stop_status
    stop_status=$(curl -sS -o /tmp/prodify-e2e-stop.json -w "%{http_code}" \
      -X POST "${API_URL}/sessions/stop" \
      -H "Authorization: Bearer ${token}" \
      -H "Content-Type: application/json" \
      -d "{\"session_id\": ${session_id}}" || true)
    echo "Stopped active E2E session ${session_id} (HTTP ${stop_status})."
    return
  fi

  echo "No active E2E session to stop (HTTP ${active_status})."
}

finalize_login() {
  local token
  token=$(read_access_token /tmp/prodify-e2e-login.json)
  stop_active_session_if_needed "$token"
  echo "E2E user login verified."
}

login_status=$(curl -sS -o /tmp/prodify-e2e-login.json -w "%{http_code}" \
  -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "$login_payload" || true)

if [[ "$login_status" == "200" ]]; then
  echo "E2E user login verified (existing account)."
  finalize_login
  exit 0
fi

echo "Login returned HTTP ${login_status}; attempting register..."
cat /tmp/prodify-e2e-login.json || true

register_payload=$(printf '{"email":"%s","password":"%s","username":"%s"}' "$EMAIL" "$PASSWORD" "$USERNAME")
register_status=$(curl -sS -o /tmp/prodify-e2e-register.json -w "%{http_code}" \
  -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "$register_payload" || true)

case "$register_status" in
  201)
    echo "Registered new E2E user."
    ;;
  400|409)
    echo "Register returned HTTP ${register_status} (account may already exist)."
    ;;
  *)
    echo "Register failed with HTTP ${register_status}:"
    cat /tmp/prodify-e2e-register.json || true
    exit 1
    ;;
esac

login_status=$(curl -sS -o /tmp/prodify-e2e-login.json -w "%{http_code}" \
  -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "$login_payload" || true)

if [[ "$login_status" != "200" ]]; then
  echo "Login smoke check failed with HTTP ${login_status}:"
  cat /tmp/prodify-e2e-login.json || true
  echo "If the account exists with a different password, reset credentials or use workflow_dispatch inputs."
  exit 1
fi

finalize_login
