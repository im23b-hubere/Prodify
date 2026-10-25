import { isE2eModeEnabled } from "./e2eMode";
import { ensureStreakNotificationChannel } from "./streakNotifications";

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

type NotificationsModule = typeof import("expo-notifications");

/** Loaded on first use, like the app's other notification code, so app start never pays for it. */
function notifications(): NotificationsModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications") as NotificationsModule;
}

/** What the OS lets this app do; null when it cannot tell (or in E2E runs, which never prompt). */
export async function readNotificationPermission(): Promise<NotificationPermissionStatus | null> {
  if (isE2eModeEnabled()) return null;
  try {
    const { status } = await notifications().getPermissionsAsync();
    return status as NotificationPermissionStatus;
  } catch {
    return null;
  }
}

/**
 * Shows the system prompt only while the user has not decided: iOS presents it a single time,
 * so after a refusal the way back is the system settings, never a second prompt.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus | null> {
  const current = await readNotificationPermission();
  if (current !== "undetermined") return current;
  try {
    await ensureStreakNotificationChannel();
    const { status } = await notifications().requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
    return status as NotificationPermissionStatus;
  } catch {
    return current;
  }
}

/** Only an explicit grant counts: a question never asked means nothing will be shown. */
export async function isNotificationPermissionGranted(): Promise<boolean> {
  return (await readNotificationPermission()) === "granted";
}
