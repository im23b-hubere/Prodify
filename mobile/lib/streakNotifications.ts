import { Platform } from "react-native";

import { isE2eModeEnabled } from "./e2eMode";
import i18n from "./i18n";

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

async function ensureAndroidChannel() {
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

export async function syncStreakRiskNotifications(atRisk: boolean, streakCount: number) {
  if (isE2eModeEnabled()) return;

  await ensureAndroidChannel();
  await cancelStreakRiskScheduled();

  if (!atRisk || streakCount <= 0) return;

  const Notifications = await import("expo-notifications");
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    return;
  }

  const now = new Date();

  for (const slot of streakSlots(streakCount)) {
    const fire = new Date(now);
    fire.setHours(slot.h, slot.m, 0, 0);
    if (fire.getTime() <= now.getTime()) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: slot.title,
        body: slot.body,
        sound: true,
        data: { kind: DATA_KIND },
        ...(Platform.OS === "android" ? { channelId: "streak" } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fire,
      },
    });
  }
}
