import type { TFunction } from "i18next";
import { useMemo } from "react";

import { buildWeeklyForecast } from "../../../lib/forecastEngine";
import { adjustedWeeklyTargetForSignupWeek } from "../../../lib/goalPace";
import { buildSessionFeedback } from "../../../lib/sessionFeedbackEngine";
import { STREAK_MILESTONES } from "../../../lib/streakMilestones";
import { buildTodayPlanRecommendation } from "../../../lib/todayPlanEngine";
import type { SessionDto } from "../../../types/session";
import type { StreakOverviewDto } from "../../../types/streak";
import { dashboardSparkKey } from "../dashboardCopy";
import { getLast7DaysProgress, getStreak, parseApiDate, toDateKey } from "../utils";

type UseDashboardPresentationOptions = {
  sessions: SessionDto[];
  streakOverview: StreakOverviewDto | null;
  loading: boolean;
  weeklyGoalTarget: number | null;
  hasWeeklyGoal: boolean;
  weekSessionsCount: number;
  accountCreatedAtIso?: string | null;
  t: TFunction;
};

type GoalPresentationOptions = {
  target: number | null;
  completed: number;
  clientStreak: number;
  streakOverview: StreakOverviewDto | null;
  visibleSessions: SessionDto[];
};

function useGoalPresentation({
  target,
  completed,
  clientStreak,
  streakOverview,
  visibleSessions,
}: GoalPresentationOptions) {
  const currentStreak = streakOverview?.current_streak ?? clientStreak;
  const todayPlan = useMemo(
    () =>
      buildTodayPlanRecommendation({
        weeklyGoalTarget: target,
        weekSessionsCount: completed,
        currentStreak,
        streakAtRisk: streakOverview?.streak_at_risk ?? false,
        lastSessionAt: visibleSessions[0]?.started_at ?? null,
        lastSessionType:
          typeof visibleSessions[0]?.session_type === "string"
            ? visibleSessions[0].session_type
            : null,
      }),
    [completed, currentStreak, streakOverview?.streak_at_risk, target, visibleSessions],
  );
  const paceForecast = useMemo(
    () =>
      target != null && target > 0
        ? buildWeeklyForecast({ weeklyGoalTarget: target, completedThisWeek: completed })
        : null,
    [completed, target],
  );
  const sessionFeedback = useMemo(
    () =>
      buildSessionFeedback({
        weeklyGoalTarget: target,
        weekSessionsCount: completed,
        currentStreak,
        sessionDurationSeconds: 0,
      }),
    [completed, currentStreak, target],
  );
  return { todayPlan, paceForecast, sessionFeedback };
}

export function useDashboardPresentation({
  sessions,
  streakOverview,
  loading,
  weeklyGoalTarget,
  hasWeeklyGoal,
  weekSessionsCount,
  accountCreatedAtIso,
  t,
}: UseDashboardPresentationOptions) {
  const visibleSessions = useMemo(
    () => sessions.filter((session) => session.stopped_at !== null),
    [sessions],
  );
  const weekProgress = useMemo(() => getLast7DaysProgress(sessions), [sessions]);
  const clientStreak = useMemo(() => getStreak(sessions), [sessions]);
  const weekSessionsForGoal = Math.max(
    0,
    Number.isFinite(weekSessionsCount) ? weekSessionsCount : 0,
  );
  const effectiveWeeklyGoalTarget = useMemo(
    () =>
      adjustedWeeklyTargetForSignupWeek({
        weeklyGoalTarget,
        accountCreatedAtIso: accountCreatedAtIso ?? null,
      }),
    [accountCreatedAtIso, weeklyGoalTarget],
  );
  const todayStats = useMemo(() => sessionsForToday(visibleSessions), [visibleSessions]);
  const { todayPlan, paceForecast, sessionFeedback } = useGoalPresentation({
    target: effectiveWeeklyGoalTarget,
    completed: weekSessionsForGoal,
    clientStreak,
    streakOverview,
    visibleSessions,
  });
  const sparkLine = useMemo(() => {
    const spark = dashboardSparkKey({
      streakAtRisk: Boolean(streakOverview?.streak_at_risk),
      streakCount: streakOverview?.current_streak ?? clientStreak,
      todayMinutes: todayStats.minutes,
      weeklyGoalComplete:
        hasWeeklyGoal &&
        effectiveWeeklyGoalTarget != null &&
        weekSessionsForGoal >= effectiveWeeklyGoalTarget,
    });
    return t(spark.key, spark.params);
  }, [
    clientStreak,
    effectiveWeeklyGoalTarget,
    hasWeeklyGoal,
    streakOverview?.current_streak,
    streakOverview?.streak_at_risk,
    t,
    todayStats.minutes,
    weekSessionsForGoal,
  ]);
  const recentSessions = useMemo(() => visibleSessions.slice(0, 3), [visibleSessions]);
  const displayOverview = useMemo(
    () =>
      streakOverview ??
      buildFallbackStreakOverview({
        loading,
        clientStreak,
        weekProgress,
        weekDayLetters: localizedWeekDayLetters(t),
        t,
      }),
    [clientStreak, loading, streakOverview, t, weekProgress],
  );
  return {
    visibleSessions,
    recentSessions,
    clientStreak,
    weekSessionsForGoal,
    effectiveWeeklyGoalTarget,
    todayStats,
    suggestedSessionType: todayPlan.suggestedSessionType,
    paceForecast,
    sessionFeedback,
    displayOverview,
    sparkLine,
  };
}

function sessionsForToday(sessions: SessionDto[]) {
  const todayKey = toDateKey(new Date());
  const todaySessions = sessions.filter(
    (session) =>
      Boolean(session.started_at) &&
      session.stopped_at !== null &&
      toDateKey(parseApiDate(session.started_at)) === todayKey,
  );
  const seconds = todaySessions.reduce(
    (total, session) => total + (session.duration_seconds ?? 0),
    0,
  );
  return { count: todaySessions.length, minutes: Math.round(seconds / 60) };
}

function localizedWeekDayLetters(t: TFunction): string[] {
  const translated = t("dashboard.weekdayShort", { returnObjects: true }) as unknown;
  const weekDayLetters =
    Array.isArray(translated) && translated.length === 7
      ? translated
      : ["M", "T", "W", "T", "F", "S", "S"];
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const mondayBasedIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
    return String(weekDayLetters[mondayBasedIndex] ?? "?");
  });
}

function buildFallbackStreakOverview({
  loading,
  clientStreak,
  weekProgress,
  weekDayLetters,
  t,
}: {
  loading: boolean;
  clientStreak: number;
  weekProgress: boolean[];
  weekDayLetters: string[];
  t: TFunction;
}): StreakOverviewDto | null {
  if (loading) return null;
  const nextMilestone = STREAK_MILESTONES.find((milestone) => clientStreak < milestone.days);
  return {
    current_streak: clientStreak,
    longest_streak: clientStreak,
    last_7_day_states: weekProgress.map((hasSession) => (hasSession ? "session" : "none")),
    last_7_day_labels: weekDayLetters,
    next_milestone_at: nextMilestone?.days ?? null,
    next_milestone_title: nextMilestone?.title ?? null,
    days_to_next_milestone: nextMilestone ? nextMilestone.days - clientStreak : null,
    freezes_remaining: 0,
    can_use_freeze: false,
    streak_at_risk: false,
    tagline: t("dashboard.streakFallbackTagline"),
  };
}
