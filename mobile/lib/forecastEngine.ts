import { clampInt, expectedWeeklySessionsByToday, mondayIndexedDay } from "./goalPace";

export type ForecastStatus = "will_miss" | "at_risk" | "on_track" | "ahead";

export type ForecastMessageKey =
  | "forecast.message.will_miss"
  | "forecast.message.at_risk"
  | "forecast.message.on_track"
  | "forecast.message.ahead";

export type ForecastTodayActionKey =
  | "forecast.todayAction.needOneToday"
  | "forecast.todayAction.needManyToday"
  | "forecast.todayAction.stayOnTrack";

export type ForecastComputed = {
  expectedSessionsByNow: number;
  remainingSessionsToGoal: number;
  sessionsPerDayNeeded: number;
  projectedTotalAtCurrentPace: number;
  forecastStatus: ForecastStatus;
  forecastMessageKey: ForecastMessageKey;
  forecastMessageParams: Record<string, number>;
  todayActionKey: ForecastTodayActionKey;
  todayActionParams: Record<string, number>;
  todayTargetSessions: number;
  todayExpectedMarkerPercent: number;
  currentProgressPercent: number;
  projectedHitDayIndex: number | null;
};

export type ForecastInput = {
  weeklyGoalTarget: number;
  completedThisWeek: number;
  now?: Date;
};

function roundToTenths(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildWeeklyForecast(input: ForecastInput): ForecastComputed {
  const now = input.now ?? new Date();
  const goal = Math.max(1, input.weeklyGoalTarget);
  const completed = Math.max(0, input.completedThisWeek);
  const dayOfWeek = mondayIndexedDay(now.getDay());
  const remainingDaysIncludingToday = Math.max(1, 8 - dayOfWeek);

  const expectedSessionsByNow = expectedWeeklySessionsByToday(goal, now);
  const remainingSessionsToGoal = Math.max(0, goal - completed);
  const sessionsPerDayNeededRaw = remainingSessionsToGoal / remainingDaysIncludingToday;
  const sessionsPerDayNeeded = roundToTenths(sessionsPerDayNeededRaw);

  const pacePerDay = completed / Math.max(1, dayOfWeek);
  const projectedTotalAtCurrentPace = roundToTenths(pacePerDay * 7);
  const missBy = Math.max(0, goal - projectedTotalAtCurrentPace);

  let forecastStatus: ForecastStatus = "on_track";
  if (projectedTotalAtCurrentPace < goal - 1) {
    forecastStatus = "will_miss";
  } else if (projectedTotalAtCurrentPace > goal) {
    forecastStatus = "ahead";
  } else if (projectedTotalAtCurrentPace < goal || sessionsPerDayNeededRaw > 1) {
    forecastStatus = "at_risk";
  }

  const forecastMessageKeyByStatus: Record<ForecastStatus, ForecastMessageKey> = {
    will_miss: "forecast.message.will_miss",
    at_risk: "forecast.message.at_risk",
    on_track: "forecast.message.on_track",
    ahead: "forecast.message.ahead",
  };

  const todayTargetSessions = clampInt(Math.ceil(sessionsPerDayNeededRaw), 0, 6);
  const todayActionKey: ForecastTodayActionKey =
    todayTargetSessions <= 0
      ? "forecast.todayAction.stayOnTrack"
      : todayTargetSessions === 1
        ? "forecast.todayAction.needOneToday"
        : "forecast.todayAction.needManyToday";

  const projectedHitDayIndex = pacePerDay > 0 ? clampInt(Math.ceil(goal / pacePerDay), 1, 7) : null;

  return {
    expectedSessionsByNow,
    remainingSessionsToGoal,
    sessionsPerDayNeeded,
    projectedTotalAtCurrentPace,
    forecastStatus,
    forecastMessageKey: forecastMessageKeyByStatus[forecastStatus],
    forecastMessageParams: {
      missBy: Math.ceil(missBy),
      sessions: remainingSessionsToGoal,
      needed: todayTargetSessions,
      projected: Math.round(projectedTotalAtCurrentPace),
      goal,
      perDay: sessionsPerDayNeeded,
    },
    todayActionKey,
    todayActionParams: {
      needed: todayTargetSessions,
    },
    todayTargetSessions,
    todayExpectedMarkerPercent: clampInt((expectedSessionsByNow / goal) * 100, 0, 100),
    currentProgressPercent: clampInt((completed / goal) * 100, 0, 100),
    projectedHitDayIndex,
  };
}
