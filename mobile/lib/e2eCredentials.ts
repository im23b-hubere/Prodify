import { isE2eModeEnabled } from "./e2eMode";

export type E2eTestCredentials = {
  email: string;
  password: string;
};

/** Baked into E2E simulator builds so Maestro does not rely on controlled TextInput typing. */
export function getE2eTestCredentials(): E2eTestCredentials | null {
  if (!isE2eModeEnabled()) return null;

  const email = process.env.EXPO_PUBLIC_E2E_TEST_EMAIL?.trim() ?? "";
  const password = process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD ?? "";
  if (!email || !password) return null;

  return { email, password };
}
