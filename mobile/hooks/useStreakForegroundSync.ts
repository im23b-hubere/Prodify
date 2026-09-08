import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { apiJson } from "../lib/client";
import { readDeviceTimezone, reportDeviceTimezone } from "../lib/deviceTimezone";

/**
 * Keep the server's view of "today" in sync, then reconcile the streak.
 *
 * The timezone is reported first on purpose: the backend resolves streak days in the user's
 * zone, so reconciling before it lands would compute the chain against the wrong day boundary.
 * Both run on mount and whenever the app returns to foreground — the latter is what catches a
 * user who crossed into a new timezone while the app was backgrounded.
 */
export function useStreakForegroundSync(token: string | null) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const reportedTimezone = useRef<string | null>(null);

  const syncTimezoneThenReconcile = useCallback(async (authToken: string) => {
    const timezone = readDeviceTimezone();
    if (timezone && timezone !== reportedTimezone.current) {
      try {
        await reportDeviceTimezone(authToken, timezone);
        reportedTimezone.current = timezone;
      } catch {
        // A failed report leaves the server on its previously stored zone, which is still
        // worth reconciling against — so this must not abort the reconcile below.
      }
    }
    await apiJson("/streak/reconcile", { method: "POST", token: authToken });
  }, []);

  useEffect(() => {
    if (!token) {
      reportedTimezone.current = null;
      return;
    }

    void syncTimezoneThenReconcile(token).catch(() => undefined);

    const subscription = AppState.addEventListener("change", (next) => {
      const wasBackground = appState.current === "inactive" || appState.current === "background";
      appState.current = next;
      if (wasBackground && next === "active") {
        void syncTimezoneThenReconcile(token).catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [token, syncTimezoneThenReconcile]);
}
