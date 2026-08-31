import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  NOTIFICATION_INBOX_KEY,
  NOTIFICATION_SETTINGS_KEY,
  NOTIFICATION_SERVER_SYNC_MS_KEY,
  NOTIFICATION_UNREAD_KEY,
  NOTIFICATION_USER_CREATED_AT_KEY,
  userScopedNotificationInboxKey,
  userScopedNotificationServerSyncKey,
  userScopedNotificationUnreadKey,
  userScopedNotificationUserCreatedAtKey,
} from "../constants/storageKeys";
import type {
  InboxItem,
  NotificationCategory,
  NotificationPriority,
  NotificationSettings,
} from "./notificationTypes";

/** @deprecated Legacy global key — retained for test cleanup only. */
export { NOTIFICATION_SERVER_SYNC_MS_KEY };

const MAX_INBOX_ITEMS = 200;
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const FIRST_WEEK_QUIET_MS = 7 * 24 * 60 * 60 * 1000;
let inboxMutationQueue: Promise<unknown> = Promise.resolve();
let activeNotificationUserId: number | null = null;

const defaultSettings: NotificationSettings = {
  streak: true,
  achievements: true,
  social: true,
  tips: true,
  quietStartHour: 23,
  quietEndHour: 7,
  frequency: "all",
};

export function getActiveNotificationUserId(): number | null {
  return activeNotificationUserId;
}

function inboxStorageKey(): string | null {
  if (activeNotificationUserId == null) return null;
  return userScopedNotificationInboxKey(activeNotificationUserId);
}

function unreadStorageKey(): string | null {
  if (activeNotificationUserId == null) return null;
  return userScopedNotificationUnreadKey(activeNotificationUserId);
}

function userCreatedAtStorageKey(): string | null {
  if (activeNotificationUserId == null) return null;
  return userScopedNotificationUserCreatedAtKey(activeNotificationUserId);
}

export async function getNotificationServerSyncMs(): Promise<number> {
  const key =
    activeNotificationUserId == null
      ? null
      : userScopedNotificationServerSyncKey(activeNotificationUserId);
  if (!key) return 0;
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function setNotificationServerSyncMs(ms: number): Promise<void> {
  const key =
    activeNotificationUserId == null
      ? null
      : userScopedNotificationServerSyncKey(activeNotificationUserId);
  if (!key) return;
  await AsyncStorage.setItem(key, String(ms));
}

export async function loadSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(s: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(s));
}

export async function loadInbox(): Promise<InboxItem[]> {
  const key = inboxStorageKey();
  if (!key) return [];
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InboxItem[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const sanitized = parsed
      .filter((item) => {
        if (!item || typeof item !== "object") return false;
        if (typeof item.createdAt !== "number" || !Number.isFinite(item.createdAt)) return false;
        if (typeof item.expiresAt === "number" && item.expiresAt <= now) return false;
        if (now - item.createdAt > DEFAULT_TTL_MS) return false;
        return true;
      })
      .map((item) => ({
        ...item,
        priority: isNotificationPriority(item.priority) ? item.priority : "normal",
      }))
      .slice(0, MAX_INBOX_ITEMS);
    if (sanitized.length !== parsed.length) {
      await saveInbox(sanitized);
    }
    return sanitized;
  } catch {
    return [];
  }
}

export async function saveInbox(items: InboxItem[]): Promise<void> {
  const key = inboxStorageKey();
  if (!key) return;
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

function unreadCountFromInbox(items: InboxItem[]): number {
  return items.reduce((count, item) => count + (item.read ? 0 : 1), 0);
}

async function runSerializedInboxMutation<T>(fn: () => Promise<T>): Promise<T> {
  const next = inboxMutationQueue.then(fn, fn);
  inboxMutationQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function getUnreadCount(): Promise<number> {
  const key = unreadStorageKey();
  if (!key) return 0;
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function setUnreadCount(n: number): Promise<void> {
  const key = unreadStorageKey();
  if (!key) return;
  await AsyncStorage.setItem(key, String(Math.max(0, n)));
}

export async function prependNotification(
  item: Omit<InboxItem, "id" | "createdAt" | "read" | "priority"> & {
    id?: string;
    priority?: NotificationPriority;
    ttlMs?: number;
    createdAtMs?: number;
    expiresAtMs?: number;
    dedupeWindowMs?: number;
    respectQuietHours?: boolean;
    bypassFirstWeekQuietMode?: boolean;
  },
): Promise<boolean> {
  if (activeNotificationUserId == null) return false;
  return runSerializedInboxMutation(async () => {
    const now = Date.now();
    const baseCreatedAt =
      typeof item.createdAtMs === "number" && Number.isFinite(item.createdAtMs)
        ? item.createdAtMs
        : now;
    const settings = await loadSettings();
    const priority = item.priority ?? "normal";
    const categoryEnabled =
      item.category === "streak"
        ? settings.streak
        : item.category === "achievement"
          ? settings.achievements
          : item.category === "social"
            ? settings.social
            : settings.tips;
    if (!categoryEnabled) return false;
    if (settings.frequency === "off") return false;
    if (settings.frequency === "important" && !isImportantPriority(priority)) return false;
    if (
      (item.respectQuietHours ?? true) &&
      isWithinQuietHours(settings) &&
      priority !== "critical"
    ) {
      return false;
    }
    if (
      !(item.bypassFirstWeekQuietMode ?? false) &&
      (await shouldSuppressForFirstWeek(item.category, priority))
    ) {
      return false;
    }

    const inbox = await loadInbox();
    if (item.id && inbox.some((existing) => existing.id === item.id)) {
      return false;
    }
    if (item.dedupeWindowMs && item.dedupeWindowMs > 0) {
      const isRecentDuplicate = inbox.some(
        (existing) =>
          existing.category === item.category &&
          existing.title === item.title &&
          existing.body === item.body &&
          Math.abs(baseCreatedAt - existing.createdAt) < item.dedupeWindowMs!,
      );
      if (isRecentDuplicate) return false;
    }
    const next: InboxItem = {
      id: item.id ?? `n-${baseCreatedAt}-${Math.random().toString(36).slice(2, 8)}`,
      category: item.category,
      priority,
      title: item.title,
      body: item.body,
      createdAt: baseCreatedAt,
      expiresAt:
        typeof item.expiresAtMs === "number" && Number.isFinite(item.expiresAtMs)
          ? Math.max(baseCreatedAt + 60_000, item.expiresAtMs)
          : baseCreatedAt + Math.max(60_000, item.ttlMs ?? DEFAULT_TTL_MS),
      read: false,
      actionLabel: item.actionLabel,
      actionRoute: item.actionRoute,
    };
    const merged = [next, ...inbox].slice(0, MAX_INBOX_ITEMS);
    await saveInbox(merged);
    await setUnreadCount(unreadCountFromInbox(merged));
    return true;
  });
}

export async function markAllRead(): Promise<void> {
  if (activeNotificationUserId == null) return;
  await runSerializedInboxMutation(async () => {
    const inbox = await loadInbox();
    const next = inbox.map((i) => ({ ...i, read: true }));
    await saveInbox(next);
    await setUnreadCount(unreadCountFromInbox(next));
  });
}

export async function markRead(id: string): Promise<void> {
  if (activeNotificationUserId == null) return;
  await runSerializedInboxMutation(async () => {
    const inbox = await loadInbox();
    const next = inbox.map((i) => {
      if (i.id === id && !i.read) {
        return { ...i, read: true };
      }
      return i;
    });
    await saveInbox(next);
    await setUnreadCount(unreadCountFromInbox(next));
  });
}

export async function removeItem(id: string): Promise<void> {
  if (activeNotificationUserId == null) return;
  await runSerializedInboxMutation(async () => {
    const inbox = await loadInbox();
    const next = inbox.filter((i) => i.id !== id);
    await saveInbox(next);
    await setUnreadCount(unreadCountFromInbox(next));
  });
}

export async function clearNotificationInbox(): Promise<void> {
  await runSerializedInboxMutation(async () => {
    if (activeNotificationUserId != null) {
      const userId = activeNotificationUserId;
      await Promise.all([
        AsyncStorage.removeItem(userScopedNotificationInboxKey(userId)),
        AsyncStorage.removeItem(userScopedNotificationUnreadKey(userId)),
        AsyncStorage.removeItem(userScopedNotificationServerSyncKey(userId)),
        AsyncStorage.removeItem(userScopedNotificationUserCreatedAtKey(userId)),
      ]);
      return;
    }
    await Promise.all([
      AsyncStorage.removeItem(NOTIFICATION_INBOX_KEY),
      AsyncStorage.removeItem(NOTIFICATION_UNREAD_KEY),
      AsyncStorage.removeItem(NOTIFICATION_SERVER_SYNC_MS_KEY),
      AsyncStorage.removeItem(NOTIFICATION_USER_CREATED_AT_KEY),
    ]);
  });
}

export async function setNotificationUserContext(
  userId: number | null | undefined,
  createdAtIso?: string | null,
): Promise<void> {
  activeNotificationUserId = userId ?? null;
  const createdAtKey = userCreatedAtStorageKey();
  if (!createdAtKey) return;
  const normalized = (createdAtIso ?? "").trim();
  if (!normalized) {
    await AsyncStorage.removeItem(createdAtKey);
    return;
  }
  await AsyncStorage.setItem(createdAtKey, normalized);
}

export function isNotificationPriority(value: unknown): value is NotificationPriority {
  return value === "low" || value === "normal" || value === "high" || value === "critical";
}

function isImportantPriority(priority: NotificationPriority): boolean {
  return priority === "high" || priority === "critical";
}

function isWithinQuietHours(settings: NotificationSettings): boolean {
  const nowHour = new Date().getHours();
  const start = settings.quietStartHour;
  const end = settings.quietEndHour;
  if (start === end) return false;
  if (start < end) return nowHour >= start && nowHour < end;
  return nowHour >= start || nowHour < end;
}

async function shouldSuppressForFirstWeek(
  category: NotificationCategory,
  priority: NotificationPriority,
): Promise<boolean> {
  if (priority === "critical" || category === "streak" || category === "achievement") {
    return false;
  }
  const key = userCreatedAtStorageKey();
  if (!key) return false;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return false;
  const createdAtMs = Date.parse(raw);
  if (!Number.isFinite(createdAtMs)) return false;
  return Date.now() - createdAtMs < FIRST_WEEK_QUIET_MS;
}
