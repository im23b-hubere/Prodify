import Constants from "expo-constants";

/**
 * True when EXPO_PUBLIC_E2E_MODE=true (CI + local screenshot dev).
 * Production builds must never enable this because it bypasses premium gates.
 */
export function isE2eModeEnabled(): boolean {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (extra?.e2eMode === true) return true;

  const appEnv =
    (typeof extra?.appEnv === "string" ? extra.appEnv : undefined) ||
    process.env.EXPO_PUBLIC_APP_ENV ||
    process.env.EXPO_PUBLIC_ENV;
  return process.env.EXPO_PUBLIC_E2E_MODE === "true" && appEnv !== "production";
}
