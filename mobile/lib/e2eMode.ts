/**
 * True when EXPO_PUBLIC_E2E_MODE=true (CI + local screenshot dev).
 * Production builds must never enable this because it bypasses premium gates.
 */
export function isE2eModeEnabled(): boolean {
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? process.env.EXPO_PUBLIC_ENV;
  return process.env.EXPO_PUBLIC_E2E_MODE === "true" && appEnv !== "production";
}
