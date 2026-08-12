import type { TFunction } from "i18next";

import type {
  InboxItem,
  NotificationCategory,
  NotificationPriority,
} from "../../lib/notificationInbox";

export const NOTIFICATION_FILTER_LABELS: Record<NotificationCategory | "all", string> = {
  all: "notificationsUi.filterAll",
  streak: "notificationsUi.catStreak",
  achievement: "notificationsUi.catAchievement",
  social: "notificationsUi.catSocial",
  tips: "notificationsUi.catTips",
};

export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: "notificationsUi.priorityLow",
  normal: "notificationsUi.priorityNormal",
  high: "notificationsUi.priorityHigh",
  critical: "notificationsUi.priorityCritical",
};

export function formatNotificationRelativeTime(
  timestamp: number,
  t: TFunction,
  now = Date.now(),
): string {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return t("notificationsUi.timeNow");
  if (minutes < 60) return t("notificationsUi.timeMin", { m: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("notificationsUi.timeHour", { h: hours });
  return t("notificationsUi.timeDay", { d: Math.floor(hours / 24) });
}

export function safeNotificationCategory(category: string): NotificationCategory {
  if (
    category === "streak" ||
    category === "achievement" ||
    category === "social" ||
    category === "tips"
  ) {
    return category;
  }
  return "tips";
}

export function filterNotifications(
  items: InboxItem[],
  filter: NotificationCategory | "all",
): InboxItem[] {
  return filter === "all"
    ? items
    : items.filter((item) => safeNotificationCategory(item.category) === filter);
}

export function latestNotificationTimestamp(items: InboxItem[], fallback: number): number {
  return items.reduce((latest, item) => Math.max(latest, item.createdAt), 0) || fallback;
}
