import type { TFunction } from "i18next";

import { classifyGoalTrackStatus, expectedWeeklySessionsByToday } from "../../lib/goalPace";
import type { GoalCurrentDto } from "../../types/goals";
import type { GoalForecastDto } from "../../types/outcomes";

export type YourWeekStatus = "setup" | "completed" | "behind" | "on_track";

export function yourWeekStatus(
  goal: GoalCurrentDto | null,
  forecast: GoalForecastDto | null,
  configured: boolean,
): YourWeekStatus {
  if (!goal || !configured) return "setup";
  if (goal.current_sessions >= goal.target_value) return "completed";
  if (forecast) {
    return forecast.risk_level === "off_track" || forecast.risk_level === "at_risk"
      ? "behind"
      : "on_track";
  }
  const track = classifyGoalTrackStatus({
    weeklyGoalTarget: goal.target_value,
    weekSessionsCount: goal.current_sessions,
    expectedByNow: expectedWeeklySessionsByToday(goal.target_value),
  });
  return track === "off_track" ? "behind" : "on_track";
}

export function activeHeatmapDayKeys(
  days: { date: string; seconds: number; intensity: number }[],
): Set<string> {
  return new Set(
    days.filter((day) => (day.seconds ?? 0) > 0 || (day.intensity ?? 0) > 0).map((day) => day.date),
  );
}

export function goalProgressPercent(goal: GoalCurrentDto | null): number {
  return goal ? Math.max(0, Math.min(100, Math.round(goal.progress_percent))) : 0;
}

export function resolveGoalTarget(customTarget: string, selectedTarget: number): number | null {
  if (!customTarget.trim()) return selectedTarget;
  const parsed = Number.parseInt(customTarget, 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 50 ? parsed : null;
}

export function forecastRiskTranslationKey(forecast: GoalForecastDto | null): string | null {
  if (!forecast) return null;
  if (forecast.risk_level === "on_track") return "stats.forecastRiskOnTrack";
  if (forecast.risk_level === "at_risk") return "stats.forecastRiskAtRisk";
  return "stats.forecastRiskOffTrack";
}

export function yourWeekNextStep(
  goal: GoalCurrentDto | null,
  forecast: GoalForecastDto | null,
  configured: boolean,
  status: YourWeekStatus,
  t: TFunction,
): string | null {
  if (!configured || !goal) return null;
  if (status === "completed") return t("stats.yourWeek.nextStepCompleted");
  if (status === "behind" && forecast?.warning_message) return forecast.warning_message;
  if (forecast && forecast.remaining_sessions > 0) {
    return t("stats.yourWeek.nextStepRemaining", { n: forecast.remaining_sessions });
  }
  return t("stats.yourWeek.nextStepOnTrack");
}
