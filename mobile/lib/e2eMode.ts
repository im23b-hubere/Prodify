/** True when EXPO_PUBLIC_E2E_MODE=true (CI + local screenshot dev). Never set in production EAS profiles. */
export function isE2eModeEnabled(): boolean {
  return process.env.EXPO_PUBLIC_E2E_MODE === "true";
}
