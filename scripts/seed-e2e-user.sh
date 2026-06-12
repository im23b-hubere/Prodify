#!/usr/bin/env bash
# Ensure the Maestro smoke-test account exists on the target API (idempotent).
set -euo pipefail

API_URL="${E2E_API_URL:-https://prodify-api-46b1.onrender.com}"
EMAIL="${E2E_TEST_EMAIL:-test@prodify.app}"
PASSWORD="${E2E_TEST_PASSWORD:-Test1234!}"
USERNAME="${E2E_TEST_USERNAME:-e2euser}"

API_URL="${API_URL%/}"

echo "Seeding E2E user at ${API_URL} (${EMAIL} / ${USERNAME})"

login_payload=$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")
login_status=$(curl -sS -o /tmp/prodify-e2e-login.json -w "%{http_code}" \
  -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "$login_payload" || true)

if [[ "$login_status" == "200" ]]; then
  echo "E2E user login verified (existing account)."
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

echo "E2E user login verified."
