import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthScopedReset } from "../../../lib/authScopedReset";
import { apiJson } from "../../../lib/client";
import { tryParseSessionDto } from "../../../lib/sessionDto";
import type { SessionDetailInsightsDto } from "../../../types/insights";
import type { SessionDto } from "../../../types/session";

export const SESSION_INSIGHTS_MIN_SECONDS = 5 * 60;

type UseSessionDetailDataOptions = {
  token?: string | null;
  userId?: number | null;
  sessionId?: string;
  t: TFunction;
  refreshSocial: () => Promise<void>;
};

export function useSessionDetailData({
  token,
  userId,
  sessionId,
  t,
  refreshSocial,
}: UseSessionDetailDataOptions) {
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const loadSequence = useRef(0);
  const insightSequence = useRef(0);
  const [session, setSession] = useState<SessionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<SessionDetailInsightsDto | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const resetSessionDetailData = useCallback(() => {
    loadSequence.current += 1;
    insightSequence.current += 1;
    setSession(null);
    setInsights(null);
    setInsightsError(null);
    setError(null);
    setRefreshing(false);
  }, []);

  useAuthScopedReset(token ?? null, userId, resetSessionDetailData);

  const load = useCallback(async () => {
    const currentToken = tokenRef.current;
    const sequence = ++loadSequence.current;
    const insightSeq = ++insightSequence.current;

    if (!currentToken || userId == null) {
      if (sequence !== loadSequence.current) return;
      if (!currentToken) setError(t("sessionDetail.notSignedIn"));
      setSession(null);
      setInsights(null);
      setInsightsError(null);
      return;
    }
    if (!sessionId) {
      if (sequence !== loadSequence.current) return;
      setError(t("sessionDetail.missingSessionId"));
      setSession(null);
      setInsights(null);
      setInsightsError(null);
      return;
    }
    if (!Number.isFinite(Number(sessionId))) {
      if (sequence !== loadSequence.current) return;
      setError(t("sessionDetail.invalidId"));
      setSession(null);
      setInsights(null);
      setInsightsError(null);
      return;
    }

    setError(null);
    try {
      const response = await apiJson<unknown>(`/sessions/item/${sessionId}`, {
        token: currentToken,
      });
      if (sequence !== loadSequence.current) return;

      const loadedSession = tryParseSessionDto(response);
      if (!loadedSession) {
        setError(t("sessionDetail.invalidData"));
        setSession(null);
        setInsights(null);
        setInsightsError(null);
        return;
      }
      setSession(loadedSession);
      await loadInsights(
        currentToken,
        sessionId,
        loadedSession,
        t,
        insightSeq,
        insightSequence,
        setInsights,
        setInsightsError,
      );
    } catch (loadError) {
      if (sequence !== loadSequence.current) return;
      setError(loadError instanceof Error ? loadError.message : t("sessionDetail.loadFailed"));
    }
  }, [sessionId, t, userId]);

  useEffect(() => {
    if (!tokenRef.current || userId == null) {
      if (!tokenRef.current) {
        setError(t("sessionDetail.notSignedIn"));
        setSession(null);
        setInsights(null);
        setInsightsError(null);
      }
      return;
    }
    void load();
  }, [load, sessionId, t, userId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
      await refreshSocial();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : t("sessionDetail.refreshFailed"),
      );
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshSocial, t]);

  const retryInsights = useCallback(() => {
    setInsightsError(null);
    void load();
  }, [load]);

  return {
    session,
    setSession,
    error,
    setError,
    insights,
    insightsError,
    refreshing,
    load,
    refresh,
    retryInsights,
  };
}

async function loadInsights(
  token: string,
  sessionId: string,
  session: SessionDto,
  t: TFunction,
  insightSeq: number,
  insightSequence: { current: number },
  setInsights: (insights: SessionDetailInsightsDto | null) => void,
  setInsightsError: (error: string | null) => void,
) {
  const insightsAvailable =
    session.stopped_at != null &&
    session.duration_seconds != null &&
    session.duration_seconds >= SESSION_INSIGHTS_MIN_SECONDS;
  if (!insightsAvailable) {
    if (insightSeq !== insightSequence.current) return;
    setInsights(null);
    setInsightsError(null);
    return;
  }
  try {
    const loadedInsights = await apiJson<SessionDetailInsightsDto>(
      `/sessions/item/${sessionId}/insights`,
      { token },
    );
    if (insightSeq !== insightSequence.current) return;
    setInsights(loadedInsights);
    setInsightsError(null);
  } catch {
    if (insightSeq !== insightSequence.current) return;
    setInsights(null);
    setInsightsError(t("sessionDetail.insightsLoadFailed"));
  }
}
