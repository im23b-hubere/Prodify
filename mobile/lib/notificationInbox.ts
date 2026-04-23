import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiJson } from "./client";
import i18n from "./i18n";

import {
  NOTIFICATION_INBOX_KEY,
  NOTIFICATION_SETTINGS_KEY,
  NOTIFICATION_UNREAD_KEY,
} from "../constants/storageKeys";

export type NotificationCategory = "streak" | "achievement" | "social" | "tips";
export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type InboxItem = {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  createdAt: number;
  expiresAt?: number;
  read: boolean;
  actionLabel?: string;
  actionRoute?: string;
};

export type NotificationSettings = {
  streak: boolean;
  achievements: boolean;
  social: boolean;
  tips: boolean;
  quietStartHour: number;
  quietEndHour: number;
  frequency: "all" | "important" | "off";
};

const NOTIFICATION_USER_CREATED_AT_KEY = "prodify_notification_user_created_at_v1";
const NOTIFICATION_SERVER_SYNC_MS_KEY = "prodify_notification_server_sync_ms_v1";
const MAX_INBOX_ITEMS = 200;
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const FIRST_WEEK_QUIET_MS = 7 * 24 * 60 * 60 * 1000;
let inboxMutationQueue: Promise<unknown> = Promise.resolve();

const defaultSettings: NotificationSettings = {
  streak: true,
  achievements: true,
  social: true,
  tips: true,
  quietStartHour: 23,
  quietEndHour: 7,
  frequency: "all",
};

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
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_INBOX_KEY);
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
        priority: isValidPriority(item.priority) ? item.priority : "normal",
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
  await AsyncStorage.setItem(NOTIFICATION_INBOX_KEY, JSON.stringify(items));
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
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_UNREAD_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function setUnreadCount(n: number): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_UNREAD_KEY, String(Math.max(0, n)));
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
  return runSerializedInboxMutation(async () => {
    const now = Date.now();
    const baseCreatedAt =
      typeof item.createdAtMs === "number" && Number.isFinite(item.createdAtMs) ? item.createdAtMs : now;
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
    if ((item.respectQuietHours ?? true) && isWithinQuietHours(settings) && priority !== "critical") {
      return false;
    }
    if (!(item.bypassFirstWeekQuietMode ?? false) && (await shouldSuppressForFirstWeek(item.category, priority))) {
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
  await runSerializedInboxMutation(async () => {
    const inbox = await loadInbox();
    const next = inbox.map((i) => ({ ...i, read: true }));
    await saveInbox(next);
    await setUnreadCount(unreadCountFromInbox(next));
  });
}

export async function markRead(id: string): Promise<void> {
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
  await runSerializedInboxMutation(async () => {
    const inbox = await loadInbox();
    const next = inbox.filter((i) => i.id !== id);
    await saveInbox(next);
    await setUnreadCount(unreadCountFromInbox(next));
  });
}

export async function clearNotificationInbox(): Promise<void> {
  await runSerializedInboxMutation(async () => {
    await Promise.all([
      AsyncStorage.removeItem(NOTIFICATION_INBOX_KEY),
      AsyncStorage.removeItem(NOTIFICATION_UNREAD_KEY),
      AsyncStorage.removeItem(NOTIFICATION_SERVER_SYNC_MS_KEY),
    ]);
  });
}

export async function setNotificationUserContext(createdAtIso: string | null | undefined): Promise<void> {
  const normalized = (createdAtIso ?? "").trim();
  if (!normalized) {
    await AsyncStorage.removeItem(NOTIFICATION_USER_CREATED_AT_KEY);
    return;
  }
  await AsyncStorage.setItem(NOTIFICATION_USER_CREATED_AT_KEY, normalized);
}

type ServerInboxItem = {
  id: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  body: string;
  title_key?: string | null;
  title_params?: Record<string, unknown> | null;
  body_key?: string | null;
  body_params?: Record<string, unknown> | null;
  created_at: string;
  expires_at?: string | null;
  read?: boolean;
  action_label?: string | null;
  action_route?: string | null;
};

export async function syncServerInbox(token: string, limit = 40): Promise<number> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const lastSyncRaw = await AsyncStorage.getItem(NOTIFICATION_SERVER_SYNC_MS_KEY);
  const lastSyncMs = lastSyncRaw ? parseInt(lastSyncRaw, 10) : 0;
  const sinceQuery = Number.isFinite(lastSyncMs) && lastSyncMs > 0 ? `&since_ms=${lastSyncMs}` : "";
  const rows = await apiJson<ServerInboxItem[]>(`/notifications/inbox?limit=${safeLimit}${sinceQuery}`, {
    token,
  });
  const syncNowMs = Date.now();
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let insertedCount = 0;
  const ordered = [...rows].reverse();
  for (const row of ordered) {
    const createdAtMs = Date.parse(row.created_at);
    if (!Number.isFinite(createdAtMs)) continue;
    const expiresAtMs = row.expires_at ? Date.parse(row.expires_at) : undefined;
    const title = resolveServerText(row.title_key, row.title_params, row.title);
    const body = resolveServerText(row.body_key, row.body_params, row.body);
    const actionLabel = resolveServerText(null, null, row.action_label ?? undefined);
    const inserted = await prependNotification({
      id: row.id,
      category: row.category,
      priority: isValidPriority(row.priority) ? row.priority : "normal",
      title,
      body,
      actionLabel,
      actionRoute: row.action_route ?? undefined,
      createdAtMs,
      expiresAtMs: Number.isFinite(expiresAtMs as number) ? (expiresAtMs as number) : undefined,
      dedupeWindowMs: 60_000,
      respectQuietHours: true,
      bypassFirstWeekQuietMode: false,
    });
    if (inserted && row.read) {
      await markRead(row.id);
    }
    if (inserted) insertedCount += 1;
  }
  await AsyncStorage.setItem(NOTIFICATION_SERVER_SYNC_MS_KEY, String(syncNowMs));
  return insertedCount;
}

export async function markServerInboxRead(token: string, upToMs: number = Date.now()): Promise<void> {
  await apiJson("/notifications/read", {
    token,
    method: "POST",
    body: { up_to_ms: Math.max(0, Math.floor(upToMs)) },
  });
}

function isValidPriority(value: unknown): value is NotificationPriority {
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
  const raw = await AsyncStorage.getItem(NOTIFICATION_USER_CREATED_AT_KEY);
  if (!raw) return false;
  const createdAtMs = Date.parse(raw);
  if (!Number.isFinite(createdAtMs)) return false;
  return Date.now() - createdAtMs < FIRST_WEEK_QUIET_MS;
}

function resolveServerText(
  key: string | null | undefined,
  params: Record<string, unknown> | null | undefined,
  fallback: string | undefined,
): string {
  if (!key || typeof key !== "string") return fallback ?? "";
  const translated = i18n.t(key, params ?? {});
  if (typeof translated === "string" && translated.trim()) return translated;
  return fallback ?? "";
}
