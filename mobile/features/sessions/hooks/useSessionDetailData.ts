import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";

import { apiJson } from "../../../lib/client";
import { tryParseSessionDto } from "../../../lib/sessionDto";
import type { SessionDetailInsightsDto } from "../../../types/insights";
import type { SessionDto } from "../../../types/session";

export const SESSION_INSIGHTS_MIN_SECONDS = 5 * 60;

type UseSessionDetailDataOptions = {
  token?: string | null;
  sessionId?: string;
  t: TFunction;
  refreshSocial: () => Promise<void>;
};

export function useSessionDetailData({
  token,
  sessionId,
  t,
  refreshSocial,
}: UseSessionDetailDataOptions) {
  const [session, setSession] = useState<SessionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<SessionDetailInsightsDto | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || !sessionId) {
      setError(!token ? t("sessionDetail.notSignedIn") : t("sessionDetail.missingSessionId"));
      setSession(null);
      return;
    }
    if (!Number.isFinite(Number(sessionId))) {
      setError(t("sessionDetail.invalidId"));
      setSession(null);
      return;
    }

    setError(null);
    const response = await apiJson<unknown>(`/sessions/item/${sessionId}`, { token });
    const loadedSession = tryParseSessionDto(response);
    if (!loadedSession) {
      setError(t("sessionDetail.invalidData"));
      setSession(null);
      return;
    }
    setSession(loadedSession);
    await loadInsights(token, sessionId, loadedSession, t, setInsights, setInsightsError);
  }, [sessionId, t, token]);

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : t("sessionDetail.loadFailed"));
    });
  }, [load, t]);

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
  setInsights: (insights: SessionDetailInsightsDto | null) => void,
  setInsightsError: (error: string | null) => void,
) {
  const insightsAvailable =
    session.stopped_at != null &&
    session.duration_seconds != null &&
    session.duration_seconds >= SESSION_INSIGHTS_MIN_SECONDS;
  if (!insightsAvailable) {
    setInsights(null);
    setInsightsError(null);
    return;
  }
  try {
    const loadedInsights = await apiJson<SessionDetailInsightsDto>(
      `/sessions/item/${sessionId}/insights`,
      { token },
    );
    setInsights(loadedInsights);
    setInsightsError(null);
  } catch {
    setInsights(null);
    setInsightsError(t("sessionDetail.insightsLoadFailed"));
  }
}
