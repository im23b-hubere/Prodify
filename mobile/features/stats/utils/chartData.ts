import { formatIsoDateShortLocal, weekdayLetterFromIsoDay } from "../../../lib/sessionTime";
import type { SessionStatsDto } from "../../../types/session";
import type { BarPoint, StatsPeriod, StatsSummaryView } from "../types";
import { formatStatsDuration, localStatsDateKey } from "./format";

export function buildStatsSummary(stats: SessionStatsDto | null): StatsSummaryView {
  const s = stats?.summary;
  if (!s) {
    return {
      hours: "0h",
      sessions: "0",
      avgSession: "0m",
      streak: 0,
      bestStreak: 0,
      delta: null,
    };
  }
  const sec = Number.isFinite(s.total_seconds) && s.total_seconds >= 0 ? s.total_seconds : 0;
  const hours = (sec / 3600).toFixed(1);
  return {
    hours: `${hours}h`,
    sessions: String(s.total_sessions),
    avgSession: formatStatsDuration(s.avg_session_seconds),
    streak: s.current_streak_days,
    bestStreak: s.best_streak_days,
    delta: s.hours_delta_vs_prior_period,
  };
}

export function buildChartData(stats: SessionStatsDto | null, period: StatsPeriod): BarPoint[] {
  const points = stats?.trend ?? [];
  if (period === "week") {
    const sessionsByDay = new Map<string, number>();
    for (const point of points) {
      if (point?.label) {
        sessionsByDay.set(
          point.label,
          Number.isFinite(point.sessions) && point.sessions >= 0 ? point.sessions : 0,
        );
      }
    }
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const isoLabel = localStatsDateKey(date);
      return {
        x: weekdayLetterFromIsoDay(isoLabel),
        y: sessionsByDay.get(isoLabel) ?? 0,
        label: isoLabel,
      };
    });
  }
  if (points.length === 0) return [];
  return points.map((p) => ({
    x: formatIsoDateShortLocal(p.label),
    y: Number.isFinite(p.sessions) && p.sessions >= 0 ? p.sessions : 0,
    label: p.label,
  }));
}
