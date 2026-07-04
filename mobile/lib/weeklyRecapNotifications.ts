import { Platform } from "react-native";

import { isE2eModeEnabled } from "./e2eMode";
import i18n from "./i18n";
import { loadSettings } from "./notificationInbox";

const DATA_KIND = "weekly-recap";
const RECAP_PATH = "/weekly-recap";
/** Sunday evening reminder — local device time. */
const SUNDAY_HOUR = 19;
const SUNDAY_MINUTE = 0;

async function ensureAndroidChannel() {
  if (Platform.OS !== "android" || isE2eModeEnabled()) return;
  const Notifications = await import("expo-notifications");
  await Notifications.setNotificationChannelAsync("weekly_recap", {
    name: i18n.t("weeklyRecapNotifications.channelName"),
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 80, 180],
    lightColor: "#a259ff",
  });
}

export async function cancelWeeklyRecapScheduled() {
  if (isE2eModeEnabled()) return;
  const Notifications = await import("expo-notifications");
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((r) => (r.content.data as { kind?: string } | undefined)?.kind === DATA_KIND)
      .map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)),
  );
}

/** Next Sunday at 19:00 local; if already past this week, the following Sunday. */
export function nextSundayRecapFireDate(from: Date = new Date()): Date {
  const fire = new Date(from);
  fire.setHours(SUNDAY_HOUR, SUNDAY_MINUTE, 0, 0);
  const day = from.getDay();
  if (day === 0) {
    if (fire.getTime() <= from.getTime()) {
      fire.setDate(fire.getDate() + 7);
    }
  } else {
    fire.setDate(fire.getDate() + (7 - day));
  }
  return fire;
}

export async function syncWeeklyRecapReminder(enabled: boolean) {
  if (isE2eModeEnabled()) return;

  await ensureAndroidChannel();
  await cancelWeeklyRecapScheduled();

  if (!enabled) return;

  const settings = await loadSettings();
  if (!settings.tips || settings.frequency === "off") return;

  const Notifications = await import("expo-notifications");
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const fire = nextSundayRecapFireDate();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t("weeklyRecapNotifications.sundayTitle"),
      body: i18n.t("weeklyRecapNotifications.sundayBody"),
      sound: true,
      data: { kind: DATA_KIND, path: RECAP_PATH },
      ...(Platform.OS === "android" ? { channelId: "weekly_recap" } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fire,
    },
  });
}
