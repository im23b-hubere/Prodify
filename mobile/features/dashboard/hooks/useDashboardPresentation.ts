import type { TFunction } from "i18next";
import { useMemo } from "react";

import { buildWeeklyForecast } from "../../../lib/forecastEngine";
import { buildSessionFeedback } from "../../../lib/sessionFeedbackEngine";
import { buildTodayPlanRecommendation } from "../../../lib/todayPlanEngine";
import { resolveCalendarWeeks, weekdayShortLabels } from "../../../lib/streakCalendarWeeks";
import type { SessionDto } from "../../../types/session";
import type { StreakOverviewDto } from "../../../types/streak";
import { dashboardSparkKey } from "../dashboardCopy";
import { parseApiDate, toDateKey } from "../utils";

type UseDashboardPresentationOptions = {
  sessions: SessionDto[];
  streakOverview: StreakOverviewDto | null;
  weeklyGoalTarget: number | null;
  hasWeeklyGoal: boolean;
  weekSessionsCount: number;
  t: TFunction;
};

type GoalPresentationOptions = {
  target: number | null;
  completed: number;
  streakOverview: StreakOverviewDto | null;
  visibleSessions: SessionDto[];
};

function useGoalPresentation({
  target,
  completed,
  streakOverview,
  visibleSessions,
}: GoalPresentationOptions) {
  const currentStreak = streakOverview?.current_streak ?? 0;
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
  weeklyGoalTarget,
  hasWeeklyGoal,
  weekSessionsCount,
  t,
}: UseDashboardPresentationOptions) {
  const visibleSessions = useMemo(
    () => sessions.filter((session) => session.stopped_at !== null),
    [sessions],
  );
  const sessionDayKeys = useMemo(() => sessionDayKeySet(visibleSessions), [visibleSessions]);
  const weekSessionsForGoal = Math.max(
    0,
    Number.isFinite(weekSessionsCount) ? weekSessionsCount : 0,
  );
  const effectiveWeeklyGoalTarget = hasWeeklyGoal ? weeklyGoalTarget : null;
  const todayStats = useMemo(() => sessionsForToday(visibleSessions), [visibleSessions]);
  const { todayPlan, paceForecast, sessionFeedback } = useGoalPresentation({
    target: effectiveWeeklyGoalTarget,
    completed: weekSessionsForGoal,
    streakOverview,
    visibleSessions,
  });
  const sparkLine = useMemo(() => {
    const spark = dashboardSparkKey({
      streakAtRisk: Boolean(streakOverview?.streak_at_risk),
      streakCount: streakOverview?.current_streak ?? 0,
      todayMinutes: todayStats.minutes,
      weeklyGoalComplete:
        hasWeeklyGoal &&
        effectiveWeeklyGoalTarget != null &&
        weekSessionsForGoal >= effectiveWeeklyGoalTarget,
    });
    return t(spark.key, spark.params);
  }, [
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
    () => (streakOverview ? withResolvedWeeks(streakOverview, sessionDayKeys, t) : null),
    [sessionDayKeys, streakOverview, t],
  );
  return {
    visibleSessions,
    recentSessions,
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

function sessionDayKeySet(sessions: SessionDto[]) {
  return new Set(
    sessions
      .map((session) => {
        if (!session.started_at?.trim()) return null;
        const parsed = parseApiDate(session.started_at);
        return Number.isFinite(parsed.getTime()) ? toDateKey(parsed) : null;
      })
      .filter((key): key is string => key != null),
  );
}

function withResolvedWeeks(
  overview: StreakOverviewDto,
  sessionDayKeys: Set<string>,
  t: TFunction,
): StreakOverviewDto {
  const labels = weekdayShortLabels(t);
  const calendar_weeks = resolveCalendarWeeks(overview, sessionDayKeys, labels);
  const current = calendar_weeks[calendar_weeks.length - 1];
  return {
    ...overview,
    calendar_weeks,
    last_7_day_states: current?.days.map((day) => day.state) ?? overview.last_7_day_states,
    last_7_day_labels: current?.days.map((day) => day.label) ?? overview.last_7_day_labels,
  };
}
