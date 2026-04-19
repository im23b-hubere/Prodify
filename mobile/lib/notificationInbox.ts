import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  NOTIFICATION_INBOX_KEY,
  NOTIFICATION_SETTINGS_KEY,
  NOTIFICATION_UNREAD_KEY,
} from "../constants/storageKeys";

export type NotificationCategory = "streak" | "achievement" | "social" | "tips";

export type InboxItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: number;
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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveInbox(items: InboxItem[]): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_INBOX_KEY, JSON.stringify(items));
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
  item: Omit<InboxItem, "id" | "createdAt" | "read"> & { id?: string },
): Promise<void> {
  const inbox = await loadInbox();
  const next: InboxItem = {
    id: item.id ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: item.category,
    title: item.title,
    body: item.body,
    createdAt: Date.now(),
    read: false,
    actionLabel: item.actionLabel,
    actionRoute: item.actionRoute,
  };
  await saveInbox([next, ...inbox].slice(0, 200));
  await setUnreadCount((await getUnreadCount()) + 1);
}

export async function markAllRead(): Promise<void> {
  const inbox = await loadInbox();
  await saveInbox(inbox.map((i) => ({ ...i, read: true })));
  await setUnreadCount(0);
}

export async function markRead(id: string): Promise<void> {
  const inbox = await loadInbox();
  let delta = 0;
  const next = inbox.map((i) => {
    if (i.id === id && !i.read) {
      delta += 1;
      return { ...i, read: true };
    }
    return i;
  });
  await saveInbox(next);
  if (delta) await setUnreadCount(Math.max(0, (await getUnreadCount()) - delta));
}

export async function removeItem(id: string): Promise<void> {
  const inbox = await loadInbox();
  const removed = inbox.find((i) => i.id === id);
  await saveInbox(inbox.filter((i) => i.id !== id));
  if (removed && !removed.read) await setUnreadCount(Math.max(0, (await getUnreadCount()) - 1));
}
