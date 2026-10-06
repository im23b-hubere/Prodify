import { weekdayLetterFromIsoDay } from "../../../lib/sessionTime";
import { localDateKey, parseIsoDate, startOfWeekMonday } from "../../../lib/weekCalendar";
import type { SessionStatsDto } from "../../../types/session";
import type { BarPoint, StatsPeriod, StatsSummaryView } from "../types";
import { CHART_ALL_WEEK_FIT, CHART_MONTH_DAYS } from "./chartScale";
import { formatAvgSessionLength, hoursFromSeconds, localMonthKey, localStatsDateKey } from "./format";

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
  today = new Date(),
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
  const chart = buildChartData(stats, period, today);
  const consistency = consistencyFromChart(chart, period);

  return {
    hours: `${hours}h`,
    sessions: String(s.total_sessions),
    avgLength: formatAvgSessionLength(avgSeconds),
    ...consistency,
    delta: s.hours_delta_vs_prior_period,
  };
}

export function buildChartData(
  stats: SessionStatsDto | null,
  period: StatsPeriod,
  today = new Date(),
): BarPoint[] {
  const hoursByLabel = hoursByTrendLabel(stats?.trend ?? []);
  if (period === "week") return paddedDays(hoursByLabel, 7, today, weekAxisLabel);
  if (period === "month") return paddedDays(hoursByLabel, CHART_MONTH_DAYS, today, monthDayAxisLabel);
  return lifetimeBars(hoursByLabel, today);
}

function hoursByTrendLabel(
  points: { label?: string; seconds?: number }[],
): Map<string, number> {
  const hoursByLabel = new Map<string, number>();
  for (const point of points) {
    if (!point?.label) continue;
    hoursByLabel.set(point.label, hoursFromSeconds(point.seconds ?? 0));
  }
  return hoursByLabel;
}

function paddedDays(
  hoursByLabel: Map<string, number>,
  count: number,
  today: Date,
  axisLabel: (iso: string, index: number, total: number) => string,
): BarPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - index));
    const isoLabel = localStatsDateKey(date);
    return {
      x: axisLabel(isoLabel, index, count),
      y: hoursByLabel.get(isoLabel) ?? 0,
      label: isoLabel,
    };
  });
}

function weekAxisLabel(iso: string): string {
  return weekdayLetterFromIsoDay(iso);
}

function monthDayAxisLabel(iso: string): string {
  const date = parseIsoDate(iso);
  return date.getDay() === 1 ? String(date.getDate()) : "";
}

function lifetimeBars(hoursByWeek: Map<string, number>, today: Date): BarPoint[] {
  if (hoursByWeek.size === 0) return [];
  const first = [...hoursByWeek.keys()].sort()[0];
  if (!first) return [];
  const weekKeys = eachWeekMonday(parseIsoDate(first), today);
  if (weekKeys.length <= CHART_ALL_WEEK_FIT) {
    return weekKeys.map((label, index) => ({
      x: lifetimeWeekAxisLabel(label, weekKeys, index),
      y: hoursByWeek.get(label) ?? 0,
      label,
    }));
  }
  const hoursByMonth = new Map<string, number>();
  for (const [week, hours] of hoursByWeek) {
    const month = week.slice(0, 7);
    hoursByMonth.set(month, (hoursByMonth.get(month) ?? 0) + hours);
  }
  const monthKeys = eachYearMonth(weekKeys[0] ?? first, today);
  return monthKeys.map((label) => ({
    x: lifetimeMonthAxisLabel(label),
    y: hoursByMonth.get(label) ?? 0,
    label,
  }));
}

function eachWeekMonday(from: Date, to: Date): string[] {
  const cursor = startOfWeekMonday(from);
  const end = startOfWeekMonday(to);
  const keys: string[] = [];
  while (cursor.getTime() <= end.getTime()) {
    keys.push(localDateKey(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return keys;
}

function eachYearMonth(fromIso: string, to: Date): string[] {
  const start = parseIsoDate(`${fromIso.slice(0, 7)}-01`);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(localMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function lifetimeWeekAxisLabel(label: string, keys: string[], index: number): string {
  const month = monthShort(label);
  if (index === 0 || index === keys.length - 1) return month;
  const previous = keys[index - 1];
  return previous && monthShort(previous) !== month ? month : "";
}

function lifetimeMonthAxisLabel(label: string): string {
  return parseIsoDate(`${label}-01`).toLocaleDateString("en-US", { month: "narrow" });
}

function monthShort(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("en-US", { month: "short" });
}
