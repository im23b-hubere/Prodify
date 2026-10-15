import AsyncStorage from "@react-native-async-storage/async-storage";

import { SERVER_PUSH_CHANNEL_KEY } from "../constants/storageKeys";

/**
 * Whether the server can push to this device. Time-based reminders the server already sends
 * (streak at risk) are only scheduled locally when it cannot, so producers never get both.
 */
export async function hasServerPushChannel(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SERVER_PUSH_CHANNEL_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markServerPushChannel(registered: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SERVER_PUSH_CHANNEL_KEY, registered ? "1" : "0");
  } catch {
    /* a failed write only means local reminders keep running as the fallback */
  }
}
