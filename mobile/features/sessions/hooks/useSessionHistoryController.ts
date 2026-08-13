import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { apiJson } from "../../../lib/client";
import type { StatsPeriod } from "../../stats/types";
import { filterSessionsByStatsPeriod } from "../utils/sessionHistoryFilter";
import { useSessionHistory } from "./useSessionHistory";

function parseStatsPeriod(value: string | string[] | undefined): StatsPeriod | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "week" || raw === "month" || raw === "all" ? raw : null;
}

export function useSessionHistoryController() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const statsPeriod = parseStatsPeriod(
    useLocalSearchParams<{ period?: string | string[] }>().period,
  );
  const history = useSessionHistory(token, t);
  const { load, removeSession, setError } = history;

  useFocusEffect(
    useCallback(() => {
      load({ reset: true }).catch(() => undefined);
    }, [load]),
  );

  const sessions = useMemo(
    () => filterSessionsByStatsPeriod(history.sessions, statsPeriod),
    [history.sessions, statsPeriod],
  );
  const subtitleKey = statsPeriod
    ? `sessionHistory.subtitle${statsPeriod === "week" ? "Week" : statsPeriod === "month" ? "Month" : "All"}`
    : "sessionHistory.subtitle";

  const dismissSession = useCallback(
    async (sessionId: number) => {
      if (!token) return;
      Haptics.selectionAsync().catch(() => undefined);
      removeSession(sessionId);
      try {
        await apiJson(`/sessions/item/${sessionId}`, { token, method: "DELETE" });
      } catch (error) {
        setError(error instanceof Error ? error.message : t("sessionHistory.deleteFailed"));
        await load({ reset: true });
      }
    },
    [load, removeSession, setError, t, token],
  );

  return {
    t,
    ...history,
    sessions,
    subtitle: t(subtitleKey),
    dismissSession,
    retry: () => {
      setError(null);
      void load({ reset: true });
    },
    goBack: () => router.back(),
    openTrash: () => router.push("/(tabs)/session-trash"),
    startSession: () => router.push("/session/setup"),
    openSession: (id: number) => router.push(`/session/${id}`),
  };
}

export type SessionHistoryController = ReturnType<typeof useSessionHistoryController>;
