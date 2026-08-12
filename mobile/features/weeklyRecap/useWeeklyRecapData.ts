import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useState } from "react";

import { apiJson } from "../../lib/client";
import { tryParseWeeklyReviewDto } from "../../lib/outcomesDto";
import { tryParseSessionStatsDto } from "../../lib/statsDto";
import type { WeeklyReviewDto } from "../../types/outcomes";
import type { SessionStatsDto } from "../../types/session";

function useGenerateWeeklyRecap(
  token: string | null,
  t: TFunction,
  setReview: (review: WeeklyReviewDto) => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generate = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = tryParseWeeklyReviewDto(
        await apiJson<unknown>("/outcomes/weekly-review/generate", {
          token,
          method: "POST",
          body: {},
        }),
      );
      if (!parsed) {
        setError(t("weeklyRecap.generateInvalid"));
        return;
      }
      setReview(parsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t("weeklyRecap.generateFailed"),
      );
    } finally {
      setBusy(false);
    }
  }, [setReview, t, token]);
  return {
    generateBusy: busy,
    generateError: error,
    clearGenerateError: setError,
    generateRecap: generate,
  };
}

export function useWeeklyRecapData(token: string | null, t: TFunction) {
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [review, setReview] = useState<WeeklyReviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statsWarning, setStatsWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { generateBusy, generateError, clearGenerateError, generateRecap } = useGenerateWeeklyRecap(
    token,
    t,
    setReview,
  );

  const load = useCallback(async () => {
    setError(null);
    setStatsWarning(null);
    clearGenerateError(null);
    if (!token) {
      setStats(null);
      setReview(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    let parsedReview: WeeklyReviewDto | null = null;
    try {
      parsedReview = tryParseWeeklyReviewDto(
        await apiJson<unknown>("/outcomes/weekly-review/current", { token }),
      );
    } catch {
      parsedReview = null;
    }
    setReview(parsedReview);

    let parsedStats: SessionStatsDto | null = null;
    let statsError: string | null = null;
    try {
      parsedStats = tryParseSessionStatsDto(
        await apiJson<unknown>("/sessions/stats?period=week", { token }),
      );
      if (!parsedStats) statsError = t("weeklyRecap.invalidStats");
    } catch (requestError) {
      statsError =
        requestError instanceof Error ? requestError.message : t("weeklyRecap.loadFailed");
    }
    setStats(parsedStats);
    if (statsError && parsedReview) setStatsWarning(statsError);
    else if (statsError) setError(statsError);
    setLoading(false);
  }, [clearGenerateError, t, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    stats,
    review,
    error,
    statsWarning,
    loading,
    generateBusy,
    generateError,
    load,
    generateRecap,
  };
}
