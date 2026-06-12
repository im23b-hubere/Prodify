import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { apiJson } from "../lib/client";

/** Reconcile streak once when the app returns to foreground (not on every dashboard load). */
export function useStreakReconcileOnForeground(token: string | null) {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!token) return;

    const sub = AppState.addEventListener("change", (next) => {
      const wasBackground = appState.current === "inactive" || appState.current === "background";
      if (wasBackground && next === "active") {
        void apiJson("/streak/reconcile", { method: "POST", token }).catch(() => undefined);
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, [token]);
}
