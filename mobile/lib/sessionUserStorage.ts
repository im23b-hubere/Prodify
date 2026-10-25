import AsyncStorage from "@react-native-async-storage/async-storage";

import { SESSION_USER_ID_KEY } from "../constants/storageKeys";

/**
 * Who was signed in, so a launch knows the account before the server answers: the stored
 * premium grant and billing are keyed by it. Only the id is kept; the profile stays on the server.
 */
export async function rememberSessionUserId(userId: number): Promise<void> {
  await AsyncStorage.setItem(SESSION_USER_ID_KEY, String(userId)).catch(() => undefined);
}

export async function readSessionUserId(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(SESSION_USER_ID_KEY).catch(() => null);
  const userId = Number(raw);
  return raw && Number.isInteger(userId) && userId > 0 ? userId : null;
}

export async function forgetSessionUserId(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_USER_ID_KEY).catch(() => undefined);
}
