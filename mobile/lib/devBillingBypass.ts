import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { DEV_BILLING_BYPASS_KEY } from "../constants/storageKeys";

let devBillingBypassMemory = false;

/** True only in Expo Go dev builds — never in release or dev clients. */
export function isExpoGoDevRuntime(): boolean {
  return __DEV__ && Constants.appOwnership === "expo";
}

export async function setDevBillingBypass(enabled: boolean): Promise<void> {
  if (!isExpoGoDevRuntime()) return;
  devBillingBypassMemory = enabled;
  if (enabled) {
    await AsyncStorage.setItem(DEV_BILLING_BYPASS_KEY, "1").catch(() => undefined);
    return;
  }
  devBillingBypassMemory = false;
  await AsyncStorage.removeItem(DEV_BILLING_BYPASS_KEY).catch(() => undefined);
}

export async function isDevBillingBypassActive(): Promise<boolean> {
  if (!isExpoGoDevRuntime()) return false;
  if (devBillingBypassMemory) return true;
  try {
    const value = await AsyncStorage.getItem(DEV_BILLING_BYPASS_KEY);
    devBillingBypassMemory = value === "1";
    return devBillingBypassMemory;
  } catch {
    return false;
  }
}

export async function clearDevBillingBypass(): Promise<void> {
  await setDevBillingBypass(false);
}
