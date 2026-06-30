import { type Href, useRouter } from "expo-router";
import { useEffect } from "react";

import { deepLinkRequiresAuth, isAllowedDeepLinkPath, toRoutableHref } from "../lib/deepLinkGuard";
import { useAuth } from "../context/AuthContext";
import { debugNav } from "../lib/debugLog";
import { setPendingDeepLinkPath } from "../lib/pendingDeepLink";
import {
  readOnboardingComplete,
  resolveUnauthenticatedAuthHref,
  toHref,
} from "../lib/postAuthNavigation";
import { isE2eModeEnabled } from "../lib/e2eMode";

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
  const { token } = useAuth();

  useEffect(() => {
    if (isE2eModeEnabled()) return;

    let mounted = true;
    let sub: { remove: () => void } | undefined;

    void import("expo-notifications")
      .then((Notifications) => {
        if (!mounted) return;

        const navigateFromResponse = (response: unknown) => {
          const r = response as
            | {
                actionIdentifier?: string;
                notification?: { request?: { content?: { data?: unknown } } };
              }
            | null
            | undefined;
          if (!r) return;
          if (r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
          const raw = r.notification?.request?.content?.data;
          const data =
            raw && typeof raw === "object" && !Array.isArray(raw)
              ? (raw as Record<string, unknown>)
              : undefined;
          const path = parsePathFromNotificationData(data);
          if (!path) return;
          const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
          if (!isAllowedDeepLinkPath(normalizedPath)) {
            debugNav("push_path_blocked", { path: normalizedPath });
            return;
          }
          if (deepLinkRequiresAuth(normalizedPath) && !token) {
            void setPendingDeepLinkPath(normalizedPath);
            void readOnboardingComplete().then((onboardingComplete) => {
              router.replace(
                toHref({ pathname: resolveUnauthenticatedAuthHref(onboardingComplete) }) as Href,
              );
            });
            return;
          }
          try {
            router.push(toRoutableHref(normalizedPath) as Href);
            void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "navigation_failed";
            debugNav("push_failed", { path, message: msg });
          }
        };

        void Notifications.getLastNotificationResponseAsync().then((last) =>
          navigateFromResponse(last),
        );

        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          navigateFromResponse(response);
        });
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, [router, token]);

  return null;
}
