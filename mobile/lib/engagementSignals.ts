import { apiJson } from "./client";

const NOTIFICATION_ID_PATTERN = /^[0-9a-f-]{8,64}$/i;

/** The server-side delivery id (`data.nid`) of a push, or null for local notifications. */
export function notificationIdOf(data: Record<string, unknown> | undefined): string | null {
  const nid = data?.nid;
  if (typeof nid !== "string" || !NOTIFICATION_ID_PATTERN.test(nid)) return null;
  return nid;
}

/** Tells the server a push was tapped, so a following session can be credited to it. */
export async function reportNotificationOpened(authToken: string, notificationId: string): Promise<void> {
  await apiJson(`/notifications/${notificationId}/opened`, { method: "POST", token: authToken });
}

export async function reportAppOpen(authToken: string): Promise<void> {
  await apiJson("/engagement/app-open", { method: "POST", token: authToken });
}

/** Only a denied permission is worth reporting: it is the producer opting out of pushes. */
export async function reportNotificationsDisabled(authToken: string): Promise<void> {
  await apiJson("/engagement/notification-permission", {
    method: "POST",
    token: authToken,
    body: { granted: false },
  });
}
