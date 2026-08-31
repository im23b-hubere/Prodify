import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  NOTIFICATION_INBOX_KEY,
  NOTIFICATION_SERVER_SYNC_MS_KEY,
  NOTIFICATION_SETTINGS_KEY,
  NOTIFICATION_UNREAD_KEY,
  userScopedNotificationInboxKey,
  userScopedNotificationServerSyncKey,
  userScopedNotificationUnreadKey,
} from "../../constants/storageKeys";
import {
  clearNotificationInbox,
  getNotificationServerSyncMs,
  getUnreadCount,
  loadInbox,
  loadSettings,
  markAllRead,
  prependNotification,
  saveSettings,
  setNotificationServerSyncMs,
  setNotificationUserContext,
} from "../../lib/notificationInbox";
import { syncServerInbox } from "../../lib/notificationServerSync";
import { apiJson } from "../../lib/client";

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

const userAItem = {
  id: "achievement-1",
  category: "achievement" as const,
  title: "User A milestone",
  body: "Unlocked",
  respectQuietHours: false,
};

const userBItem = {
  id: "achievement-2",
  category: "achievement" as const,
  title: "User B milestone",
  body: "Unlocked",
  respectQuietHours: false,
};

describe("notification inbox store", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await setNotificationUserContext(1, "2026-01-01T00:00:00Z");
  });

  it("persists a notification and updates the unread count", async () => {
    const inserted = await prependNotification(userAItem);

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

  it("marks all entries read and clears current account inbox state", async () => {
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

describe("notification inbox account scope", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("keeps User A inbox hidden after switching to User B", async () => {
    await setNotificationUserContext(1, "2026-01-01T00:00:00Z");
    await prependNotification(userAItem);

    await setNotificationUserContext(2, "2026-02-01T00:00:00Z");
    expect(await loadInbox()).toEqual([]);
  });

  it("does not carry User A unread count to User B", async () => {
    await setNotificationUserContext(1, "2026-01-01T00:00:00Z");
    await prependNotification(userAItem);
    expect(await getUnreadCount()).toBe(1);

    await setNotificationUserContext(2, "2026-02-01T00:00:00Z");
    expect(await getUnreadCount()).toBe(0);
  });

  it("does not reuse User A server sync cursor for User B", async () => {
    await setNotificationUserContext(1, "2026-01-01T00:00:00Z");
    await setNotificationServerSyncMs(1_700_000_000_000);

    await setNotificationUserContext(2, "2026-02-01T00:00:00Z");
    expect(await getNotificationServerSyncMs()).toBe(0);

    mockApiJson.mockResolvedValue([]);
    await syncServerInbox("token-b", 40);

    expect(mockApiJson).toHaveBeenCalledWith("/notifications/inbox?limit=40", {
      token: "token-b",
    });
  });

  it("restores User A inbox after switching back to User A", async () => {
    await setNotificationUserContext(1, "2026-01-01T00:00:00Z");
    await prependNotification(userAItem);

    await setNotificationUserContext(2, "2026-02-01T00:00:00Z");
    await prependNotification(userBItem);

    await setNotificationUserContext(1, "2026-01-01T00:00:00Z");
    expect(await loadInbox()).toEqual([
      expect.objectContaining({ id: "achievement-1", title: "User A milestone" }),
    ]);
  });

  it("returns empty inbox while unauthenticated", async () => {
    await setNotificationUserContext(1, "2026-01-01T00:00:00Z");
    await prependNotification(userAItem);

    await setNotificationUserContext(null);
    expect(await loadInbox()).toEqual([]);
    expect(await getUnreadCount()).toBe(0);
  });

  it("does not expose legacy global inbox to a newly bound account", async () => {
    await AsyncStorage.setItem(
      NOTIFICATION_INBOX_KEY,
      JSON.stringify([
        {
          id: "legacy-1",
          category: "social",
          priority: "normal",
          title: "Legacy",
          body: "Old global inbox",
          createdAt: Date.now(),
          expiresAt: Date.now() + 86_400_000,
          read: false,
        },
      ]),
    );
    await AsyncStorage.setItem(NOTIFICATION_UNREAD_KEY, "1");
    await AsyncStorage.setItem(NOTIFICATION_SERVER_SYNC_MS_KEY, "1700000000000");

    await setNotificationUserContext(99, "2026-03-01T00:00:00Z");
    expect(await loadInbox()).toEqual([]);
    expect(await getUnreadCount()).toBe(0);
    expect(await getNotificationServerSyncMs()).toBe(0);
  });

  it("keeps notification settings device-scoped across account switches", async () => {
    const deviceSettings = {
      streak: false,
      achievements: true,
      social: false,
      tips: true,
      quietStartHour: 22,
      quietEndHour: 6,
      frequency: "important" as const,
    };

    await setNotificationUserContext(1, "2026-01-01T00:00:00Z");
    await saveSettings(deviceSettings);

    await setNotificationUserContext(2, "2026-02-01T00:00:00Z");
    expect(await loadSettings()).toEqual(deviceSettings);

    const raw = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("_1");
    expect(raw).not.toContain("_2");
  });
});

describe("notification inbox scoped storage keys", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("persists inbox and unread under user-scoped keys", async () => {
    await setNotificationUserContext(1, "2026-01-01T00:00:00Z");
    await prependNotification(userAItem);

    expect(await AsyncStorage.getItem(userScopedNotificationInboxKey(1))).toBeTruthy();
    expect(await AsyncStorage.getItem(userScopedNotificationUnreadKey(1))).toBe("1");
    expect(await AsyncStorage.getItem(NOTIFICATION_INBOX_KEY)).toBeNull();
  });

  it("persists server sync timestamp under user-scoped keys", async () => {
    await setNotificationUserContext(1, "2026-01-01T00:00:00Z");
    await setNotificationServerSyncMs(1_700_000_111_000);

    expect(await AsyncStorage.getItem(userScopedNotificationServerSyncKey(1))).toBe(
      "1700000111000",
    );
  });
});
