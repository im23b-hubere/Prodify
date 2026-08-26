#!/usr/bin/env bash
# Run Prodify iOS Maestro flows on macOS CI (native Maestro) or via agent-device replay locally.
# Supports a single MAESTRO_FLOW or a named MAESTRO_SUITE (see mobile/maestro/suites/).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARTIFACTS="${ROOT}/artifacts/agent-device-ios"
FLOW="${MAESTRO_FLOW:-maestro/flows/smoke_test.yaml}"
MAESTRO_SUITE="${MAESTRO_SUITE:-none}"
APP_BUNDLE_ID="com.prodify.app"

mkdir -p "$ARTIFACTS"

cd "$ROOT/mobile"

FLOWS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && FLOWS+=("$line")
done < <(bash "${ROOT}/scripts/qa/resolve-maestro-flows.sh" "${MAESTRO_SUITE}" "${FLOW}")
if [[ "${#FLOWS[@]}" -eq 0 ]]; then
  echo "No Maestro flows resolved (suite='${MAESTRO_SUITE}', flow='${FLOW}')."
  exit 1
fi

echo "Maestro suite: ${MAESTRO_SUITE}"
echo "Maestro flows (${#FLOWS[@]}):"
for flow in "${FLOWS[@]}"; do
  echo "  - ${flow}"
done
echo "Artifacts: ${ARTIFACTS}"

flow_slug() {
  local flow="$1"
  local base
  base="$(basename "$flow")"
  echo "${base%.yaml}"
}

timeout_ms_for_flow() {
  local flow="$1"
  if [[ "${MAESTRO_SUITE}" != "none" && -n "${MAESTRO_SUITE}" ]]; then
    if [[ "$flow" == *"full_app_test"* ]]; then
      echo "900000"
    elif [[ "$flow" == *"bootstrap_dashboard"* ]]; then
      echo "300000"
    else
      echo "600000"
    fi
    return
  fi
  if [[ -n "${AGENT_DEVICE_REPLAY_TIMEOUT_MS:-}" ]]; then
    echo "${AGENT_DEVICE_REPLAY_TIMEOUT_MS}"
    return
  fi
  if [[ "$flow" == *"full_app_test"* ]]; then
    echo "900000"
  elif [[ "$flow" == *"bootstrap_dashboard"* ]]; then
    echo "300000"
  else
    echo "600000"
  fi
}

copy_latest_maestro_tests() {
  local dest="$1"
  if [[ ! -d "${HOME}/.maestro/tests" ]]; then
    return 0
  fi
  mkdir -p "${dest}/maestro-tests"
  local latest
  latest="$(ls -1dt "${HOME}/.maestro/tests"/*/ 2>/dev/null | head -1 || true)"
  if [[ -n "${latest}" ]]; then
    cp -R "${latest}." "${dest}/maestro-tests/" 2>/dev/null || true
  else
    cp -R "${HOME}/.maestro/tests/." "${dest}/maestro-tests/" 2>/dev/null || true
  fi
}

capture_failure_artifacts() {
  local dest="${1:-$ARTIFACTS}"
  mkdir -p "$dest"
  if [[ "${CI:-}" == "true" && -n "${SIMULATOR_UDID:-}" ]]; then
    xcrun simctl io "${SIMULATOR_UDID}" screenshot "${dest}/failure.png" 2>/dev/null || true
    copy_latest_maestro_tests "$dest"
  else
    agent-device screenshot "${dest}/failure.png" --platform ios 2>/dev/null || true
    agent-device logs dump 100 --platform ios > "${dest}/logs.txt" 2>/dev/null || true
  fi
}

capture_success_artifacts() {
  local dest="${1:-$ARTIFACTS}"
  mkdir -p "$dest"
  if [[ "${CI:-}" == "true" && -n "${SIMULATOR_UDID:-}" ]]; then
    xcrun simctl io "${SIMULATOR_UDID}" screenshot "${dest}/success.png" 2>/dev/null || true
  else
    agent-device screenshot "${dest}/success.png" --platform ios 2>/dev/null || true
  fi
}

sync_root_artifacts() {
  local dest="$1"
  local result="$2"
  mkdir -p "$ARTIFACTS"
  if [[ -f "${dest}/maestro-output.log" ]]; then
    cp -f "${dest}/maestro-output.log" "${ARTIFACTS}/maestro-output.log"
  fi
  if [[ "$result" == "PASS" && -f "${dest}/success.png" ]]; then
    cp -f "${dest}/success.png" "${ARTIFACTS}/success.png"
    rm -f "${ARTIFACTS}/failure.png"
  elif [[ "$result" == "FAIL" && -f "${dest}/failure.png" ]]; then
    cp -f "${dest}/failure.png" "${ARTIFACTS}/failure.png"
  fi
  if [[ -d "${dest}/maestro-tests" ]]; then
    mkdir -p "${ARTIFACTS}/maestro-tests"
    cp -R "${dest}/maestro-tests/." "${ARTIFACTS}/maestro-tests/" 2>/dev/null || true
  fi
}

prepare_flow() {
  local is_first="$1"
  if [[ "${CI:-}" == "true" && -n "${SIMULATOR_UDID:-}" ]]; then
    echo "Reset: terminate ${APP_BUNDLE_ID} (keep install; flows use launchApp clearState)"
    xcrun simctl terminate "${SIMULATOR_UDID}" "${APP_BUNDLE_ID}" 2>/dev/null || true
  fi
  # Suite mode: reseed before every flow so leftover API sessions cannot leak.
  # Single-flow: the workflow seed step already ran; do not add extra API traffic.
  if [[ "${MAESTRO_SUITE}" != "none" && -n "${MAESTRO_SUITE}" ]] || [[ "$is_first" != "1" ]]; then
    echo "Reset: reseed E2E user to stop leftover API sessions"
    if ! bash "${ROOT}/scripts/seed-e2e-user.sh"; then
      echo "Warning: E2E seed between flows failed; continuing with existing account state"
    fi
  fi
}

run_native_maestro_flow() {
  local flow="$1"
  local log="$2"
  if [[ "${flow}" == *"onboarding_to_login"* ]]; then
    echo "Opening onboarding directly through simctl"
    xcrun simctl openurl "${SIMULATOR_UDID}" "prodify://onboarding"
    sleep 3
  fi
  if maestro --device "${SIMULATOR_UDID}" test \
    -e "TEST_EMAIL=${E2E_TEST_EMAIL}" \
    -e "TEST_PASSWORD=${E2E_TEST_PASSWORD}" \
    "${flow}" 2>&1 | tee "${log}"; then
    return 0
  fi
  if grep -Fq "iOS driver not ready in time" "${log}"; then
    echo "Maestro iOS driver startup timed out; retrying once..."
    xcrun simctl bootstatus "${SIMULATOR_UDID}" -b
    sleep 15
    if maestro --device "${SIMULATOR_UDID}" test \
      -e "TEST_EMAIL=${E2E_TEST_EMAIL}" \
      -e "TEST_PASSWORD=${E2E_TEST_PASSWORD}" \
      "${flow}" 2>&1 | tee -a "${log}"; then
      return 0
    fi
  fi
  return 1
}

run_agent_device_flow() {
  local flow="$1"
  local timeout_ms="$2"
  echo "agent-device replay: ${flow}"
  agent-device replay "${flow}" \
    --maestro \
    --platform ios \
    --timeout "${timeout_ms}" \
    -e "TEST_EMAIL=${E2E_TEST_EMAIL}" \
    -e "TEST_PASSWORD=${E2E_TEST_PASSWORD}"
}

RESULTS=()
FAILED=0
FLOW_INDEX=0

if [[ "${CI:-}" == "true" && -n "${SIMULATOR_UDID:-}" ]]; then
  echo "Running native Maestro on simulator ${SIMULATOR_UDID}"
  export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-300000}"
fi

for flow in "${FLOWS[@]}"; do
  FLOW_INDEX=$((FLOW_INDEX + 1))
  slug="$(flow_slug "$flow")"
  flow_artifacts="${ARTIFACTS}/${slug}"
  mkdir -p "$flow_artifacts"
  timeout_ms="$(timeout_ms_for_flow "$flow")"
  is_first=0
  if [[ "$FLOW_INDEX" -eq 1 ]]; then
    is_first=1
  fi

  echo ""
  echo "======== Maestro flow ${FLOW_INDEX}/${#FLOWS[@]}: ${flow} ========"
  prepare_flow "$is_first"

  set +e
  if [[ "${CI:-}" == "true" && -n "${SIMULATOR_UDID:-}" ]]; then
    run_native_maestro_flow "$flow" "${flow_artifacts}/maestro-output.log"
    status=$?
  else
    run_agent_device_flow "$flow" "$timeout_ms"
    status=$?
  fi
  set -e

  if [[ "$status" -eq 0 ]]; then
    capture_success_artifacts "$flow_artifacts"
    RESULTS+=("${slug}|PASS")
    sync_root_artifacts "$flow_artifacts" "PASS"
    echo "Maestro passed: ${flow}"
  else
    capture_failure_artifacts "$flow_artifacts"
    RESULTS+=("${slug}|FAIL")
    sync_root_artifacts "$flow_artifacts" "FAIL"
    FAILED=$((FAILED + 1))
    echo "Maestro failed: ${flow}"
  fi
done

if [[ "${CI:-}" != "true" ]]; then
  agent-device close --platform ios 2>/dev/null || true
fi

echo ""
echo "======== Maestro suite results ========"
SUMMARY_FILE="${ARTIFACTS}/suite-summary.txt"
: > "$SUMMARY_FILE"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Maestro suite results"
    echo ""
    echo "| Flow | Result |"
    echo "| --- | --- |"
  } >> "$GITHUB_STEP_SUMMARY"
fi
for entry in "${RESULTS[@]}"; do
  slug="${entry%%|*}"
  result="${entry##*|}"
  printf '%-22s %s\n' "$slug" "$result" | tee -a "$SUMMARY_FILE"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    echo "| \`${slug}\` | **${result}** |" >> "$GITHUB_STEP_SUMMARY"
  fi
done
echo "======================================="

if [[ "$FAILED" -gt 0 ]]; then
  echo "Required flows failed: ${FAILED}/${#FLOWS[@]}"
  exit 1
fi

echo "All ${#FLOWS[@]} Maestro flow(s) passed."
