import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../context/AuthContext";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { buildWrappedSlides } from "./wrappedSlides";
import { useWeeklyRecapData } from "./useWeeklyRecapData";
import { formatWeekRangeLabel } from "./weeklyRecapPresentation";
import { useWeeklyRecapSharing } from "./useWeeklyRecapSharing";

export function useWeeklyRecapController() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const data = useWeeklyRecapData(token, t);
  const summary = data.stats?.summary;
  const displaySessions = data.review?.total_sessions ?? summary?.total_sessions ?? 0;
  const seconds = Number.isFinite(data.review?.total_seconds)
    ? (data.review?.total_seconds ?? 0)
    : (summary?.total_seconds ?? 0);
  const displayHours = Number.isFinite(seconds) ? (seconds / 3600).toFixed(1) : "0.0";
  const weekRange =
    data.review?.week_start && data.review.week_end
      ? formatWeekRangeLabel(data.review.week_start, data.review.week_end)
      : "";
  const topBreakdown = useMemo(
    () => [...(data.stats?.breakdown ?? [])].sort((a, b) => b.sessions - a.sessions)[0] ?? null,
    [data.stats?.breakdown],
  );
  const slides = useMemo(
    () =>
      buildWrappedSlides({
        t,
        review: data.review,
        stats: data.stats,
        displaySessions,
        displayHours,
        weekRange,
      }),
    [data.review, data.stats, displayHours, displaySessions, t, weekRange],
  );
  const sharing = useWeeklyRecapSharing({
    t,
    review: data.review,
    stats: data.stats,
    displaySessions,
    displayHours,
  });
  return {
    t,
    token,
    ...data,
    slides,
    summary,
    displaySessions,
    displayHours,
    weekRange,
    topTypeLabel: topBreakdown?.sessions
      ? sessionTypeLabel(String(topBreakdown.session_type), t)
      : null,
    hasCardData: Boolean(summary || data.review),
    ...sharing,
    close: () => router.back(),
    signIn: () => router.replace("/(auth)/login"),
    setGoals: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      router.push("/(tabs)/stats");
    },
    startSession: () => router.push("/session/setup"),
  };
}

export type WeeklyRecapController = ReturnType<typeof useWeeklyRecapController>;
