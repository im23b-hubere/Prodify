import * as Notifications from "expo-notifications";
import { type Href, useRouter } from "expo-router";
import { useEffect } from "react";

import { debugNav } from "../lib/debugLog";

function parsePathFromNotificationData(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (typeof data.path === "string" && data.path.startsWith("/")) {
    return data.path;
  }
  const url = data.url;
  if (typeof url === "string" && url.startsWith("prodify://")) {
    const rest = url.slice("prodify://".length);
    if (rest.startsWith("/")) return rest;
    if (rest.length > 0) return `/${rest}`;
  }
  return null;
}

/**
 * Opens an in-app route when the user taps a push that includes `data.path` (Expo Router href).
 * Clears the last notification response after handling so the same tap cannot re-route on next launch.
 */
export function NotificationNavBridge() {
  const router = useRouter();

  useEffect(() => {
    const navigateFromResponse = (response: Notifications.NotificationResponse | null | undefined) => {
      if (!response) return;
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const raw = response.notification.request.content.data;
      const data = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
      const path = parsePathFromNotificationData(data);
      if (!path) return;
      try {
        router.push(path as Href);
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "navigation_failed";
        debugNav("push_failed", { path, message: msg });
      }
    };

    void Notifications.getLastNotificationResponseAsync().then((last) => navigateFromResponse(last));

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromResponse(response);
    });
    return () => sub.remove();
  }, [router]);

  return null;
}
