#!/usr/bin/env bash
# Run Prodify iOS Maestro flows on macOS CI (native Maestro) or via agent-device replay locally.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARTIFACTS="${ROOT}/artifacts/agent-device-ios"
FLOW="${MAESTRO_FLOW:-maestro/flows/smoke_test.yaml}"
TIMEOUT_MS="${AGENT_DEVICE_REPLAY_TIMEOUT_MS:-600000}"
if [[ "${MAESTRO_FLOW:-}" == *"full_app_test"* ]]; then
  TIMEOUT_MS="${AGENT_DEVICE_REPLAY_TIMEOUT_MS:-900000}"
fi

mkdir -p "$ARTIFACTS"

cd "$ROOT/mobile"

echo "Maestro flow: ${FLOW}"
echo "Artifacts: ${ARTIFACTS}"

capture_failure_artifacts() {
  if [[ "${CI:-}" == "true" && -n "${SIMULATOR_UDID:-}" ]]; then
    xcrun simctl io "${SIMULATOR_UDID}" screenshot "${ARTIFACTS}/failure.png" 2>/dev/null || true
    if [[ -d "${HOME}/.maestro/tests" ]]; then
      mkdir -p "${ARTIFACTS}/maestro-tests"
      cp -R "${HOME}/.maestro/tests/." "${ARTIFACTS}/maestro-tests/" 2>/dev/null || true
    fi
  else
    agent-device screenshot "${ARTIFACTS}/failure.png" --platform ios 2>/dev/null || true
    agent-device logs dump 100 --platform ios > "${ARTIFACTS}/logs.txt" 2>/dev/null || true
    agent-device close --platform ios 2>/dev/null || true
  fi
}

capture_success_artifacts() {
  if [[ "${CI:-}" == "true" && -n "${SIMULATOR_UDID:-}" ]]; then
    xcrun simctl io "${SIMULATOR_UDID}" screenshot "${ARTIFACTS}/success.png" 2>/dev/null || true
  else
    agent-device screenshot "${ARTIFACTS}/success.png" --platform ios 2>/dev/null || true
    agent-device close --platform ios 2>/dev/null || true
  fi
}

trap capture_failure_artifacts ERR

if [[ "${CI:-}" == "true" && -n "${SIMULATOR_UDID:-}" ]]; then
  echo "Running native Maestro on simulator ${SIMULATOR_UDID}"
  export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-300000}"
  MAESTRO_LOG="${ARTIFACTS}/maestro-output.log"
  if ! maestro --device "${SIMULATOR_UDID}" test \
    -e "TEST_EMAIL=${E2E_TEST_EMAIL}" \
    -e "TEST_PASSWORD=${E2E_TEST_PASSWORD}" \
    "${FLOW}" 2>&1 | tee "${MAESTRO_LOG}"; then
    if grep -Fq "iOS driver not ready in time" "${MAESTRO_LOG}"; then
      echo "Maestro iOS driver startup timed out; retrying once..."
      xcrun simctl bootstatus "${SIMULATOR_UDID}" -b
      sleep 15
      maestro --device "${SIMULATOR_UDID}" test \
        -e "TEST_EMAIL=${E2E_TEST_EMAIL}" \
        -e "TEST_PASSWORD=${E2E_TEST_PASSWORD}" \
        "${FLOW}"
    else
      exit 1
    fi
  fi
else
  echo "agent-device replay: ${FLOW}"
  agent-device replay "${FLOW}" \
    --maestro \
    --platform ios \
    --timeout "${TIMEOUT_MS}" \
    -e "TEST_EMAIL=${E2E_TEST_EMAIL}" \
    -e "TEST_PASSWORD=${E2E_TEST_PASSWORD}"
fi

trap - ERR
capture_success_artifacts

echo "Maestro passed: ${FLOW}"
