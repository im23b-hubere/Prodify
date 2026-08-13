import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { buildWeeklyForecast } from "../../../lib/forecastEngine";
import { adjustedWeeklyTargetForSignupWeek } from "../../../lib/goalPace";
import { buildSessionFeedback } from "../../../lib/sessionFeedbackEngine";
import { useSessionCompleteData } from "./useSessionCompleteData";
import { estimateSessionXpGain } from "../sessionCompletePresentation";

export function useSessionCompleteController() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const rawId = useLocalSearchParams<{ id: string | string[] }>().id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const data = useSessionCompleteData(token, id, t);
  const durationSeconds = data.session?.duration_seconds ?? 0;
  const weeklyGoalTarget = useMemo(
    () =>
      adjustedWeeklyTargetForSignupWeek({
        weeklyGoalTarget: data.weeklyGoalTarget,
        accountCreatedAtIso: user?.created_at ?? null,
      }),
    [data.weeklyGoalTarget, user?.created_at],
  );
  const feedback = useMemo(
    () =>
      buildSessionFeedback({
        weeklyGoalTarget,
        weekSessionsCount: data.weekSessionsCount,
        currentStreak: data.streak ?? 0,
        sessionDurationSeconds: durationSeconds,
      }),
    [data.streak, data.weekSessionsCount, durationSeconds, weeklyGoalTarget],
  );
  const paceForecast = useMemo(
    () =>
      weeklyGoalTarget && weeklyGoalTarget > 0
        ? buildWeeklyForecast({ weeklyGoalTarget, completedThisWeek: data.weekSessionsCount })
        : null,
    [data.weekSessionsCount, weeklyGoalTarget],
  );
  return {
    t,
    id,
    ...data,
    durationSeconds,
    weeklyGoalTarget,
    feedback,
    paceForecast,
    xpGainEstimate: estimateSessionXpGain(durationSeconds),
    openDetails: () => router.replace(`/session/${id}` as never),
    openDashboard: () => router.replace("/(tabs)/dashboard"),
  };
}

export type SessionCompleteController = ReturnType<typeof useSessionCompleteController>;
