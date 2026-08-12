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

type CompletionRequest = { token: string; sessionId: string };

function resolveCompletionRequest(
  token: string | null,
  sessionId: string | undefined,
  t: TFunction,
): CompletionRequest | { error: string } {
  if (!token) return { error: t("sessionComplete.notSignedIn") };
  if (!sessionId) return { error: t("sessionComplete.missingSession") };
  if (!Number.isFinite(Number(sessionId))) return { error: t("sessionComplete.invalidSession") };
  return { token, sessionId };
}

async function loadCompletedSession(request: CompletionRequest, t: TFunction) {
  const rawSession = await apiJson<unknown>(`/sessions/item/${request.sessionId}`, {
    token: request.token,
  });
  const session = tryParseSessionDto(rawSession);
  if (!session) throw new Error(t("sessionComplete.invalidData"));
  if (session.stopped_at == null) throw new Error(t("sessionComplete.stillInProgress"));
  return session;
}

async function loadCompletionSummary(token: string) {
  const [statsRaw, progression, rawGoal] = await Promise.all([
    apiJson<unknown>("/sessions/stats?period=all", { token }).catch(() => null),
    syncProgression(token, { force: true }).catch(() => null),
    apiJson<unknown>("/goals/current", { token }).catch(() => null),
  ]);
  return {
    streak: statsRaw
      ? (tryParseSessionStatsDto(statsRaw)?.summary.current_streak_days ?? null)
      : null,
    progression,
    rawGoal,
  };
}

function useCompletionLifecycle(reload: () => Promise<void>, cancelled: { current: boolean }) {
  useEffect(() => {
    cancelled.current = false;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void reload();
    return () => {
      cancelled.current = true;
    };
  }, [cancelled, reload]);
}

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
    const request = resolveCompletionRequest(token, sessionId, t);
    if ("error" in request) {
      fail(request.error);
      return;
    }

    setLoadState("loading");
    setLoadError(null);
    try {
      const completedSession = await loadCompletedSession(request, t);
      if (cancelled.current) return;
      setSession(completedSession);

      const summary = await loadCompletionSummary(request.token);
      if (cancelled.current) return;
      setStreak(summary.streak);
      setProgression(summary.progression);
      applyGoalResult(
        summary.rawGoal,
        completedSession.duration_seconds ?? 0,
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

  useCompletionLifecycle(reload, cancelled);

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
