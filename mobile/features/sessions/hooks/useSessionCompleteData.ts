import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiJson } from "../../../lib/client";
import { syncProgression } from "../../../lib/progressionSync";
import { tryParseSessionDto } from "../../../lib/sessionDto";
import { tryParseSessionStatsDto } from "../../../lib/statsDto";
import type { ProgressionDto } from "../../../types/outcomes";
import type { SessionDto } from "../../../types/session";
import { MINIMUM_COUNTED_SESSION_SECONDS } from "../sessionCompletePresentation";

type LoadState = "loading" | "ready" | "error";

type SessionCompleteData = {
  session: SessionDto | null;
  streak: number | null;
  progression: ProgressionDto | null;
  weeklyGoalTarget: number | null;
  weekSessionsCount: number;
  loadState: LoadState;
  loadError: string | null;
  reload: () => Promise<void>;
};

export function useSessionCompleteData(
  token: string | null,
  sessionId: string | undefined,
  t: TFunction,
): SessionCompleteData {
  const [session, setSession] = useState<SessionDto | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [progression, setProgression] = useState<ProgressionDto | null>(null);
  const [weeklyGoalTarget, setWeeklyGoalTarget] = useState<number | null>(null);
  const [weekSessionsCount, setWeekSessionsCount] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const fail = useCallback((message: string) => {
    setLoadState("error");
    setLoadError(message);
    setSession(null);
  }, []);

  const reload = useCallback(async () => {
    if (!token || !sessionId) {
      fail(!token ? t("sessionComplete.notSignedIn") : t("sessionComplete.missingSession"));
      return;
    }
    if (!Number.isFinite(Number(sessionId))) {
      fail(t("sessionComplete.invalidSession"));
      return;
    }

    setLoadState("loading");
    setLoadError(null);
    try {
      const rawSession = await apiJson<unknown>(`/sessions/item/${sessionId}`, { token });
      if (cancelled.current) return;
      const parsedSession = tryParseSessionDto(rawSession);
      if (!parsedSession) {
        fail(t("sessionComplete.invalidData"));
        return;
      }
      if (parsedSession.stopped_at == null) {
        fail(t("sessionComplete.stillInProgress"));
        return;
      }
      setSession(parsedSession);

      const [statsRaw, progressionResult, goalRaw] = await Promise.all([
        apiJson<unknown>("/sessions/stats?period=all", { token }).catch(() => null),
        syncProgression(token, { force: true }).catch(() => null),
        apiJson<unknown>("/goals/current", { token }).catch(() => null),
      ]);
      if (cancelled.current) return;

      const stats = statsRaw ? tryParseSessionStatsDto(statsRaw) : null;
      setStreak(stats?.summary.current_streak_days ?? null);
      setProgression(progressionResult);
      applyGoalResult(
        goalRaw,
        parsedSession.duration_seconds ?? 0,
        setWeeklyGoalTarget,
        setWeekSessionsCount,
      );
      setLoadState("ready");
    } catch (error) {
      if (!cancelled.current) {
        fail(error instanceof Error ? error.message : t("sessionComplete.loadError"));
      }
    }
  }, [fail, sessionId, t, token]);

  useEffect(() => {
    cancelled.current = false;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void reload();
    return () => {
      cancelled.current = true;
    };
  }, [reload]);

  return {
    session,
    streak,
    progression,
    weeklyGoalTarget,
    weekSessionsCount,
    loadState,
    loadError,
    reload,
  };
}

function applyGoalResult(
  rawGoal: unknown,
  durationSeconds: number,
  setTarget: (value: number | null) => void,
  setCount: (value: number) => void,
) {
  if (!rawGoal || typeof rawGoal !== "object") {
    setTarget(null);
    setCount(0);
    return;
  }

  const goal = rawGoal as { target_value?: unknown; current_sessions?: unknown };
  setTarget(typeof goal.target_value === "number" ? goal.target_value : null);
  let count = typeof goal.current_sessions === "number" ? goal.current_sessions : 0;
  if (durationSeconds < MINIMUM_COUNTED_SESSION_SECONDS && count > 0) count -= 1;
  setCount(Math.max(0, count));
}
