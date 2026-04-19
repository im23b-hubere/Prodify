import AsyncStorage from "@react-native-async-storage/async-storage";

import { ONBOARDING_COMPLETE_KEY } from "../constants/storageKeys";

/** Route after successful registration — always show onboarding for new accounts. */
export const POST_REGISTER_HREF = "/onboarding" as const;

export type PostLoginHref = "/(tabs)/dashboard" | "/onboarding";

/**
 * After login: go to dashboard only if this device has completed onboarding before;
 * otherwise show onboarding (existing user on a new device, or never finished flow).
 */
export async function getPostLoginHref(): Promise<PostLoginHref> {
  try {
    const v = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return v === "1" ? "/(tabs)/dashboard" : "/onboarding";
  } catch {
    return "/onboarding";
  }
}
