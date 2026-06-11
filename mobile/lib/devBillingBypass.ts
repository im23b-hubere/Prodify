import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { DEV_BILLING_BYPASS_KEY } from "../constants/storageKeys";

/** True only in Expo Go dev builds — never in release or dev clients. */
export function isExpoGoDevRuntime(): boolean {
  return __DEV__ && Constants.appOwnership === "expo";
}

export async function setDevBillingBypass(enabled: boolean): Promise<void> {
  if (!isExpoGoDevRuntime()) return;
  if (enabled) {
    await AsyncStorage.setItem(DEV_BILLING_BYPASS_KEY, "1").catch(() => undefined);
    return;
  }
  await AsyncStorage.removeItem(DEV_BILLING_BYPASS_KEY).catch(() => undefined);
}

export async function isDevBillingBypassActive(): Promise<boolean> {
  if (!isExpoGoDevRuntime()) return false;
  try {
    const value = await AsyncStorage.getItem(DEV_BILLING_BYPASS_KEY);
    return value === "1";
  } catch {
    return false;
  }
}

export async function clearDevBillingBypass(): Promise<void> {
  await setDevBillingBypass(false);
}
