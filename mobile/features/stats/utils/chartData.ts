import { formatIsoDateShortLocal, weekdayLetterFromIsoDay } from "../../../lib/sessionTime";
import type { SessionStatsDto } from "../../../types/session";
import type { BarPoint, StatsPeriod, StatsSummaryView } from "../types";
import { formatAvgSessionLength, localStatsDateKey } from "./format";

function consistencyFromChart(chart: BarPoint[], period: StatsPeriod) {
  const totalDays = period === "week" ? 7 : chart.length;
  if (totalDays <= 0) {
    return { consistencyPercent: 0, consistencyActiveDays: 0, consistencyTotalDays: 0 };
  }
  const activeDays = chart.filter((point) => point.y > 0).length;
  return {
    consistencyPercent: Math.round((activeDays / totalDays) * 100),
    consistencyActiveDays: activeDays,
    consistencyTotalDays: totalDays,
  };
}

export function buildStatsSummary(
  stats: SessionStatsDto | null,
  period: StatsPeriod = "week",
): StatsSummaryView {
  const empty: StatsSummaryView = {
    hours: "0h",
    sessions: "0",
    avgLength: "0m",
    consistencyPercent: 0,
    consistencyActiveDays: 0,
    consistencyTotalDays: period === "week" ? 7 : 0,
    delta: null,
  };
  const s = stats?.summary;
  if (!s) return empty;

  const sec = Number.isFinite(s.total_seconds) && s.total_seconds >= 0 ? s.total_seconds : 0;
  const hours = (sec / 3600).toFixed(1);
  const avgSeconds =
    Number.isFinite(s.avg_session_seconds) && s.avg_session_seconds >= 0
      ? s.avg_session_seconds
      : 0;
  const chart = buildChartData(stats, period);
  const consistency = consistencyFromChart(chart, period);

  return {
    hours: `${hours}h`,
    sessions: String(s.total_sessions),
    avgLength: formatAvgSessionLength(avgSeconds),
    ...consistency,
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
