import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearNotificationInbox,
  getUnreadCount,
  loadInbox,
  markAllRead,
  prependNotification,
} from "../../lib/notificationInbox";

describe("notification inbox store", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("persists a notification and updates the unread count", async () => {
    const inserted = await prependNotification({
      id: "achievement-1",
      category: "achievement",
      title: "Milestone",
      body: "Unlocked",
      respectQuietHours: false,
    });

    expect(inserted).toBe(true);
    expect(await loadInbox()).toEqual([
      expect.objectContaining({ id: "achievement-1", priority: "normal", read: false }),
    ]);
    expect(await getUnreadCount()).toBe(1);
  });

  it("rejects duplicate stable ids", async () => {
    const notification = {
      id: "friend-request-7",
      category: "social" as const,
      title: "Friend request",
      body: "A producer sent a request",
      respectQuietHours: false,
      bypassFirstWeekQuietMode: true,
    };

    expect(await prependNotification(notification)).toBe(true);
    expect(await prependNotification(notification)).toBe(false);
    expect(await loadInbox()).toHaveLength(1);
  });

  it("marks all entries read and clears all inbox state", async () => {
    await prependNotification({
      id: "streak-1",
      category: "streak",
      priority: "critical",
      title: "Streak risk",
      body: "Start a session",
      respectQuietHours: false,
    });

    await markAllRead();
    expect((await loadInbox())[0]?.read).toBe(true);
    expect(await getUnreadCount()).toBe(0);

    await clearNotificationInbox();
    expect(await loadInbox()).toEqual([]);
  });
});
