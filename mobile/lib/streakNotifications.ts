import { Platform } from "react-native";

import { isE2eModeEnabled } from "./e2eMode";
import i18n from "./i18n";
import { hasServerPushChannel } from "./serverPushChannel";

const DATA_KIND = "streak-risk";

let handlerConfigured = false;

/** Call once at app root so foreground notifications behave correctly. */
export function configureNotificationHandler() {
  if (isE2eModeEnabled()) return;
  if (handlerConfigured) return;
  handlerConfigured = true;
  void import("expo-notifications")
    .then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    })
    .catch(() => {
      handlerConfigured = false;
    });
}

/** Android 13 only shows the permission prompt once the app has a notification channel. */
export async function ensureStreakNotificationChannel() {
  if (Platform.OS !== "android" || isE2eModeEnabled()) return;
  const Notifications = await import("expo-notifications");
  await Notifications.setNotificationChannelAsync("streak", {
    name: i18n.t("streakNotifications.channelName"),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 120, 250],
    lightColor: "#FF3D00",
  });
}

async function cancelStreakRiskScheduled() {
  if (isE2eModeEnabled()) return;
  const Notifications = await import("expo-notifications");
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((r) => (r.content.data as { kind?: string } | undefined)?.kind === DATA_KIND)
      .map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)),
  );
}

function streakSlots(streakCount: number) {
  const n = Math.max(1, streakCount);
  return [
    {
      h: 22,
      m: 0,
      title: i18n.t("streakNotifications.slot22Title"),
      body: i18n.t("streakNotifications.slot22Body", { count: n }),
    },
    {
      h: 23,
      m: 0,
      title: i18n.t("streakNotifications.slot23Title"),
      body: i18n.t("streakNotifications.slot23Body", { count: n }),
    },
    {
      h: 23,
      m: 30,
      title: i18n.t("streakNotifications.slot2330Title"),
      body: i18n.t("streakNotifications.slot2330Body", { count: n }),
    },
  ];
}

type StreakReminder = { fireAt: Date; title: string; body: string };

/**
 * Local streak reminders still to fire today. The server sends the same reminders as push,
 * so a device it can reach gets none locally.
 */
export function streakReminderPlan(input: {
  atRisk: boolean;
  streakCount: number;
  serverCanPush: boolean;
  now: Date;
}): StreakReminder[] {
  if (!input.atRisk || input.streakCount <= 0 || input.serverCanPush) return [];
  return streakSlots(input.streakCount)
    .map((slot) => {
      const fireAt = new Date(input.now);
      fireAt.setHours(slot.h, slot.m, 0, 0);
      return { fireAt, title: slot.title, body: slot.body };
    })
    .filter((reminder) => reminder.fireAt.getTime() > input.now.getTime());
}

export async function syncStreakRiskNotifications(atRisk: boolean, streakCount: number) {
  if (isE2eModeEnabled()) return;

  await ensureStreakNotificationChannel();
  await cancelStreakRiskScheduled();

  const plan = streakReminderPlan({
    atRisk,
    streakCount,
    serverCanPush: await hasServerPushChannel(),
    now: new Date(),
  });
  if (plan.length === 0) return;

  const Notifications = await import("expo-notifications");
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    return;
  }

  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        sound: true,
        data: { kind: DATA_KIND },
        ...(Platform.OS === "android" ? { channelId: "streak" } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.fireAt,
      },
    });
  }
}
