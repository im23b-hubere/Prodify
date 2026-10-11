import type { TFunction } from "i18next";

import type { InboxItem, NotificationCategory } from "../../lib/notificationInbox";

export const NOTIFICATION_FILTER_LABELS: Record<NotificationCategory | "all", string> = {
  all: "notificationsUi.filterAll",
  streak: "notificationsUi.catStreak",
  achievement: "notificationsUi.catAchievement",
  social: "notificationsUi.catSocial",
  tips: "notificationsUi.catTips",
};

/** What a notification is about, which picks its icon: finer than its category. */
export type NotificationKind = "challenge" | "comment" | "friend" | NotificationCategory;

export function notificationKind(
  item: Pick<InboxItem, "category" | "actionRoute">,
): NotificationKind {
  const route = item.actionRoute ?? "";
  if (route.startsWith("/challenge")) return "challenge";
  if (/^\/session\/\d+/.test(route)) return "comment";
  if (route.startsWith("/(tabs)/friends")) return "friend";
  return safeNotificationCategory(item.category);
}

export type NotificationSectionKey = "today" | "yesterday" | "earlier";
export type NotificationSection = { key: NotificationSectionKey; data: InboxItem[] };

/** Newest first, grouped by local day: today, yesterday, and everything before. */
export function notificationSections(items: InboxItem[], now = Date.now()): NotificationSection[] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const today = midnight.getTime();
  midnight.setDate(midnight.getDate() - 1);
  const yesterday = midnight.getTime();
  const buckets: Record<NotificationSectionKey, InboxItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const item of [...items].sort((a, b) => b.createdAt - a.createdAt)) {
    const key =
      item.createdAt >= today ? "today" : item.createdAt >= yesterday ? "yesterday" : "earlier";
    buckets[key].push(item);
  }
  return (["today", "yesterday", "earlier"] as const)
    .map((key) => ({ key, data: buckets[key] }))
    .filter((section) => section.data.length > 0);
}

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
