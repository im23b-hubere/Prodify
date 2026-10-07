import { Platform } from "react-native";

import { isE2eModeEnabled } from "./e2eMode";
import i18n from "./i18n";
import {
  SESSION_AUTO_STOP_SECONDS,
  SESSION_STILL_THERE_SECONDS,
  isSessionRunning,
  presenceFireDate,
} from "./sessionPresence";
import { parseSessionDate } from "./sessionTime";
import type { SessionDto } from "../types/session";

const STILL_THERE_KIND = "session-still-there";
const AUTO_STOP_KIND = "session-auto-stop";
const PRESENCE_KINDS = new Set([STILL_THERE_KIND, AUTO_STOP_KIND]);

export function sessionPresenceSchedule(
  session: SessionDto | null,
  fromMs: number,
): { stillThere: Date | null; autoStop: Date | null } {
  if (!isSessionRunning(session) || !session?.started_at?.trim()) {
    return { stillThere: null, autoStop: null };
  }
  const startedAtMs = parseSessionDate(session.started_at).getTime();
  const paused = session.paused_duration_seconds ?? 0;
  return {
    stillThere: presenceFireDate(startedAtMs, paused, SESSION_STILL_THERE_SECONDS, fromMs),
    autoStop: presenceFireDate(startedAtMs, paused, SESSION_AUTO_STOP_SECONDS, fromMs),
  };
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android" || isE2eModeEnabled()) return;
  const Notifications = await import("expo-notifications");
  await Notifications.setNotificationChannelAsync("session_presence", {
    name: i18n.t("sessionPresenceNotifications.channelName"),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 80, 180],
    lightColor: "#a259ff",
  });
}

export async function cancelSessionPresenceScheduled() {
  if (isE2eModeEnabled()) return;
  const Notifications = await import("expo-notifications");
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((entry) => PRESENCE_KINDS.has(String((entry.content.data as { kind?: string } | undefined)?.kind)))
      .map((entry) => Notifications.cancelScheduledNotificationAsync(entry.identifier)),
  );
}

export async function syncSessionPresenceNotifications(session: SessionDto | null) {
  if (isE2eModeEnabled()) return;

  await ensureAndroidChannel();
  await cancelSessionPresenceScheduled();

  const plan = sessionPresenceSchedule(session, Date.now());
  if (plan.stillThere == null && plan.autoStop == null) return;

  const Notifications = await import("expo-notifications");
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  await schedulePresenceNotification(
    Notifications,
    STILL_THERE_KIND,
    "sessionPresenceNotifications.stillThereTitle",
    "sessionPresenceNotifications.stillThereBody",
    plan.stillThere,
  );
  await schedulePresenceNotification(
    Notifications,
    AUTO_STOP_KIND,
    "sessionPresenceNotifications.autoStoppedTitle",
    "sessionPresenceNotifications.autoStoppedBody",
    plan.autoStop,
  );
}

async function schedulePresenceNotification(
  Notifications: typeof import("expo-notifications"),
  kind: string,
  titleKey: string,
  bodyKey: string,
  fire: Date | null,
) {
  if (fire == null) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t(titleKey),
      body: i18n.t(bodyKey),
      sound: true,
      data: { kind, path: "/(tabs)/dashboard" },
      ...(Platform.OS === "android" ? { channelId: "session_presence" } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fire,
    },
  });
}
