import { apiJson } from "./client";
import i18n from "./i18n";
import {
  getNotificationServerSyncMs,
  isNotificationPriority,
  loadInbox,
  markRead,
  prependNotification,
  setNotificationServerSyncMs,
} from "./notificationLocalStore";
import type { NotificationCategory, NotificationPriority } from "./notificationTypes";

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
  const lastSyncMs = await getNotificationServerSyncMs();
  const sinceQuery = lastSyncMs > 0 ? `&since_ms=${lastSyncMs}` : "";
  const rows = await apiJson<ServerInboxItem[]>(
    `/notifications/inbox?limit=${safeLimit}${sinceQuery}`,
    {
      token,
    },
  );
  const syncNowMs = Date.now();
  if (!Array.isArray(rows) || rows.length === 0) {
    await setNotificationServerSyncMs(syncNowMs);
    return 0;
  }

  let insertedCount = 0;
  let anySoftSkip = false;
  let sawProcessableRow = false;
  const ordered = [...rows].reverse();
  let snapshot = await loadInbox();

  for (const row of ordered) {
    const createdAtMs = Date.parse(row.created_at);
    if (!Number.isFinite(createdAtMs)) continue;
    sawProcessableRow = true;

    if (snapshot.some((i) => i.id === row.id)) {
      if (row.read) {
        await markRead(row.id);
      }
      continue;
    }

    const expiresAtMs = row.expires_at ? Date.parse(row.expires_at) : undefined;
    const title = resolveServerText(row.title_key, row.title_params, row.title);
    const body = resolveServerText(row.body_key, row.body_params, row.body);
    const actionLabel = resolveServerText(null, null, row.action_label ?? undefined);
    const inserted = await prependNotification({
      id: row.id,
      category: row.category,
      priority: isNotificationPriority(row.priority) ? row.priority : "normal",
      title,
      body,
      actionLabel,
      actionRoute: row.action_route ?? undefined,
      createdAtMs,
      expiresAtMs: Number.isFinite(expiresAtMs as number) ? (expiresAtMs as number) : undefined,
      dedupeWindowMs: 60_000,
      respectQuietHours: true,
      bypassFirstWeekQuietMode:
        row.category === "social" &&
        typeof row.id === "string" &&
        row.id.startsWith("friend-request-"),
    });
    if (inserted) {
      insertedCount += 1;
      if (row.read) {
        await markRead(row.id);
      }
      snapshot = await loadInbox();
    } else {
      anySoftSkip = true;
    }
  }

  if (!sawProcessableRow || !anySoftSkip) {
    await setNotificationServerSyncMs(syncNowMs);
  }
  return insertedCount;
}

export async function markServerInboxRead(
  token: string,
  upToMs: number = Date.now(),
): Promise<void> {
  await apiJson("/notifications/read", {
    token,
    method: "POST",
    body: { up_to_ms: Math.max(0, Math.floor(upToMs)) },
  });
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
