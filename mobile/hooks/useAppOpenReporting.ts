import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { reportAppOpen } from "../lib/engagementSignals";

/**
 * Report each time the signed-in app comes to the foreground. The server counts at most one
 * open per half hour, so this does not need its own throttle.
 */
export function useAppOpenReporting(token: string | null) {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!token) return;

    void reportAppOpen(token).catch(() => undefined);

    const subscription = AppState.addEventListener("change", (next) => {
      const wasBackground = appState.current === "inactive" || appState.current === "background";
      appState.current = next;
      if (wasBackground && next === "active") {
        void reportAppOpen(token).catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [token]);
}
