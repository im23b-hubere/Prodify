import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiJson } from "./client";

/** Best-effort: register Expo push token + (Android) native FCM token with API. */
export async function registerPushTokenWithBackend(authToken: string): Promise<void> {
  try {
    const projectId =
      (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | undefined)?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const expoToken = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId: String(projectId) } : undefined
    );
    const expoStr = expoToken.data;
    if (expoStr) {
      await apiJson("/notifications/register-token", {
        token: authToken,
        method: "POST",
        body: { token: expoStr, platform: Platform.OS, channel: "expo" },
      });
    }

    if (Platform.OS === "android") {
      try {
        const native = await Notifications.getDevicePushTokenAsync();
        const nativeStr = native?.data;
        if (nativeStr && nativeStr !== expoStr) {
          await apiJson("/notifications/register-token", {
            token: authToken,
            method: "POST",
            body: { token: nativeStr, platform: "android", channel: "fcm" },
          });
        }
      } catch {
        /* Expo Go / missing google-services */
      }
    }
  } catch {
    /* simulator / no project id / network */
  }
}
