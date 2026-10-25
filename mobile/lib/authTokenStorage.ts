import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { INSTALL_MARKER_KEY, REFRESH_TOKEN_KEY } from "../constants/storageKeys";
import { isE2eModeEnabled } from "./e2eMode";

export const ACCESS_TOKEN_KEY = "prodify_token";

async function setItem(key: string, value: string): Promise<void> {
  if (isE2eModeEnabled()) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isE2eModeEnabled()) {
    return AsyncStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function deleteItem(key: string): Promise<void> {
  if (isE2eModeEnabled()) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

export async function readAccessToken(): Promise<string | null> {
  const stored = await getItem(ACCESS_TOKEN_KEY);
  return stored?.trim() ? stored.trim() : null;
}

export async function readRefreshToken(): Promise<string | null> {
  const stored = await getItem(REFRESH_TOKEN_KEY);
  return stored?.trim() ? stored.trim() : null;
}

export async function writeTokenPair(accessToken: string, refreshToken: string): Promise<void> {
  await setItem(ACCESS_TOKEN_KEY, accessToken);
  await setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokenPair(): Promise<void> {
  await deleteItem(ACCESS_TOKEN_KEY);
  await deleteItem(REFRESH_TOKEN_KEY);
}

/**
 * The keychain outlives an uninstall, so a reinstalled app would wake up signed in to the old
 * account. AsyncStorage does not, which makes a missing marker mean "fresh install". When the
 * marker cannot be read or written the session stays, so a storage fault never signs anyone out.
 */
export async function discardTokensFromPreviousInstall(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(INSTALL_MARKER_KEY)) !== null) return;
    await AsyncStorage.setItem(INSTALL_MARKER_KEY, "1");
  } catch {
    return;
  }
  await clearTokenPair();
}
