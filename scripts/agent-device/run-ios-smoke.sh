#!/usr/bin/env bash
# Run Prodify iOS smoke via agent-device Maestro replay (used on macOS CI runners).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARTIFACTS="${ROOT}/artifacts/agent-device-ios"
FLOW="${MAESTRO_FLOW:-maestro/flows/smoke_test.yaml}"
TIMEOUT_MS="${AGENT_DEVICE_REPLAY_TIMEOUT_MS:-600000}"

mkdir -p "$ARTIFACTS"

cd "$ROOT/mobile"

echo "agent-device replay: ${FLOW}"
echo "Artifacts: ${ARTIFACTS}"

on_failure() {
  agent-device screenshot "${ARTIFACTS}/failure.png" --platform ios 2>/dev/null || true
  agent-device logs dump 100 --platform ios > "${ARTIFACTS}/logs.txt" 2>/dev/null || true
  agent-device close --platform ios 2>/dev/null || true
}

trap on_failure ERR

agent-device replay "${FLOW}" \
  --maestro \
  --platform ios \
  --timeout "${TIMEOUT_MS}" \
  -e "TEST_EMAIL=${E2E_TEST_EMAIL}" \
  -e "TEST_PASSWORD=${E2E_TEST_PASSWORD}"

agent-device screenshot "${ARTIFACTS}/success.png" --platform ios 2>/dev/null || true
agent-device close --platform ios 2>/dev/null || true

echo "Smoke passed."
