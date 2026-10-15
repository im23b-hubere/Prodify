import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { reportAppOpen, reportNotificationsDisabled } from "../lib/engagementSignals";
import { isNotificationPermissionGranted } from "../lib/notificationPermission";

async function reportOpen(token: string): Promise<void> {
  await reportAppOpen(token);
  if (!(await isNotificationPermissionGranted())) {
    await reportNotificationsDisabled(token);
  }
}

/**
 * Report each time the signed-in app comes to the foreground, along with a denied notification
 * permission. The server counts at most one open per half hour, so this needs no throttle.
 */
export function useAppOpenReporting(token: string | null) {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!token) return;

    void reportOpen(token).catch(() => undefined);

    const subscription = AppState.addEventListener("change", (next) => {
      const wasBackground = appState.current === "inactive" || appState.current === "background";
      appState.current = next;
      if (wasBackground && next === "active") {
        void reportOpen(token).catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [token]);
}
