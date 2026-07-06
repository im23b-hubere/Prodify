import Constants from "expo-constants";

import { isE2eModeEnabled } from "./e2eMode";

export type E2eTestCredentials = {
  email: string;
  password: string;
};

const DEFAULT_E2E_EMAIL = "test@prodify.app";
const DEFAULT_E2E_PASSWORD = "Test1234!";

function readExtraString(key: string): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === "string" ? value : "";
}

/** Baked into E2E simulator builds so Maestro does not rely on controlled TextInput typing. */
export function getE2eTestCredentials(): E2eTestCredentials | null {
  if (!isE2eModeEnabled()) return null;

  const email = (
    readExtraString("e2eTestEmail") ||
    process.env.EXPO_PUBLIC_E2E_TEST_EMAIL ||
    DEFAULT_E2E_EMAIL
  ).trim();
  const password =
    readExtraString("e2eTestPassword") ||
    process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD ||
    DEFAULT_E2E_PASSWORD;

  if (!email || !password) return null;
  return { email, password };
}
