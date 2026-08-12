import type { TFunction } from "i18next";

import {
  filterNotifications,
  formatNotificationRelativeTime,
  latestNotificationTimestamp,
  safeNotificationCategory,
} from "../../../features/notifications/notificationPresentation";
import type { InboxItem } from "../../../lib/notificationInbox";

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as TFunction;

const item = (id: string, category: InboxItem["category"], createdAt: number): InboxItem => ({
  id,
  category,
  priority: "normal",
  title: id,
  body: id,
  createdAt,
  read: false,
});

describe("notification presentation", () => {
  it("formats relative time buckets deterministically", () => {
    const now = 1_000_000_000;
    expect(formatNotificationRelativeTime(now - 20_000, t, now)).toBe("notificationsUi.timeNow");
    expect(formatNotificationRelativeTime(now - 5 * 60_000, t, now)).toContain('"m":5');
    expect(formatNotificationRelativeTime(now - 3 * 3_600_000, t, now)).toContain('"h":3');
    expect(formatNotificationRelativeTime(now - 2 * 86_400_000, t, now)).toContain('"d":2');
  });

  it("normalizes unknown categories and filters known categories", () => {
    expect(safeNotificationCategory("unexpected")).toBe("tips");
    const items = [item("a", "social", 10), item("b", "tips", 20)];
    expect(filterNotifications(items, "social").map(({ id }) => id)).toEqual(["a"]);
    expect(filterNotifications(items, "all")).toBe(items);
  });

  it("finds the latest visible timestamp or uses its fallback", () => {
    expect(latestNotificationTimestamp([item("a", "social", 10), item("b", "tips", 30)], 99)).toBe(
      30,
    );
    expect(latestNotificationTimestamp([], 99)).toBe(99);
  });
});
