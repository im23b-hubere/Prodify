/** True only when EXPO_PUBLIC_E2E_MODE=true (CI simulator builds). Never set in production EAS profiles. */
export function isE2eModeEnabled(): boolean {
  return process.env.EXPO_PUBLIC_E2E_MODE === "true";
}
