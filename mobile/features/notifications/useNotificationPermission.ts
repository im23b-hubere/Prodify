import { useCallback, useEffect, useState } from "react";
import { AppState, Linking } from "react-native";

import { useAuth } from "../../context/AuthContext";
import {
  readNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionStatus,
} from "../../lib/notificationPermission";
import { registerPushTokenWithBackend } from "../../lib/pushToken";

/**
 * Whether the OS lets Prodify show notifications, re-read whenever the app returns to the
 * foreground so a change made in the system settings shows up at once.
 */
export function useNotificationPermission() {
  const { token } = useAuth();
  const [status, setStatus] = useState<NotificationPermissionStatus | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      readNotificationPermission().then((next) => {
        if (!active) return;
        setStatus(next);
        setSettled(true);
      });
    void load();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void load();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  /** Asks once; a grant registers this device for server pushes right away. */
  const request = useCallback(async () => {
    const next = await requestNotificationPermission();
    setStatus(next);
    if (next === "granted" && token)
      await registerPushTokenWithBackend(token).catch(() => undefined);
    return next;
  }, [token]);

  const openSettings = useCallback(() => {
    void Linking.openSettings().catch(() => undefined);
  }, []);

  return { status, settled, request, openSettings };
}
