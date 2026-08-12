import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useState } from "react";

import { apiJson } from "../../lib/client";
import { tryParseWeeklyReviewDto } from "../../lib/outcomesDto";
import { tryParseSessionStatsDto } from "../../lib/statsDto";
import type { WeeklyReviewDto } from "../../types/outcomes";
import type { SessionStatsDto } from "../../types/session";

export function useWeeklyRecapData(token: string | null, t: TFunction) {
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [review, setReview] = useState<WeeklyReviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statsWarning, setStatsWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setStatsWarning(null);
    setGenerateError(null);
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
  }, [t, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const generateRecap = useCallback(async () => {
    if (!token) return;
    setGenerateBusy(true);
    setGenerateError(null);
    try {
      const parsed = tryParseWeeklyReviewDto(
        await apiJson<unknown>("/outcomes/weekly-review/generate", {
          token,
          method: "POST",
          body: {},
        }),
      );
      if (!parsed) {
        setGenerateError(t("weeklyRecap.generateInvalid"));
        return;
      }
      setReview(parsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (requestError) {
      setGenerateError(
        requestError instanceof Error ? requestError.message : t("weeklyRecap.generateFailed"),
      );
    } finally {
      setGenerateBusy(false);
    }
  }, [t, token]);

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
