import { addDaysIso, parseIsoDate } from "../../../lib/weekCalendar";
import type { BarPoint, StatsPeriod } from "../types";
import { CHART_MONTH_DAYS, isMonthBarLabel } from "./chartScale";

export type ChartAverageKind = "period" | "perDay";

export type ChartHero = {
  averageHours: number;
  averageKind: ChartAverageKind;
  rangeLabel: string;
};

export function buildChartHero(
  bars: BarPoint[],
  period: StatsPeriod,
  totalSeconds: number,
  today = new Date(),
): ChartHero {
  const dayCount = chartPeriodDayCount(period, bars, today);
  const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  return {
    averageHours: dayCount <= 0 ? 0 : safeSeconds / dayCount / 3600,
    averageKind: period === "all" ? "perDay" : "period",
    rangeLabel: chartRangeLabel(bars),
  };
}

export function chartRangeLabel(bars: BarPoint[]): string {
  const first = bars[0]?.label;
  const last = bars[bars.length - 1]?.label;
  if (!first || !last) return "";
  if (isMonthBarLabel(first) && isMonthBarLabel(last)) {
    return `${formatMonthYear(first)} – ${formatMonthYear(last)}`;
  }
  return formatDayRange(parseIsoDate(first), parseIsoDate(last));
}

export function chartBarRangeLabel(bar: BarPoint, period: StatsPeriod): string {
  if (isMonthBarLabel(bar.label)) {
    return parseIsoDate(`${bar.label}-01`).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }
  const start = parseIsoDate(bar.label);
  if (period === "all") {
    return formatDayRange(start, parseIsoDate(addDaysIso(bar.label, 6)));
  }
  return formatLongDay(start);
}

export function chartYTicks(maxBarHours: number): number[] {
  const top = chartPlotMax(maxBarHours);
  if (top === 1) return [0, 0.5, 1];
  return [0, top / 2, top];
}

export function chartPlotMax(maxBarHours: number): number {
  if (maxBarHours <= 0) return 1;
  const padded = maxBarHours * 1.2;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const residual = padded / magnitude;
  const nice = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 3 ? 3 : residual <= 5 ? 5 : 10;
  return nice * magnitude;
}

function chartPeriodDayCount(period: StatsPeriod, bars: BarPoint[], today: Date): number {
  if (period === "week") return 7;
  if (period === "month") return CHART_MONTH_DAYS;
  const first = bars[0]?.label;
  if (!first) return 1;
  const start = isMonthBarLabel(first) ? parseIsoDate(`${first}-01`) : parseIsoDate(first);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function formatLongDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDayRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endText = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startText} – ${endText}`;
}

function formatMonthYear(yearMonth: string): string {
  return parseIsoDate(`${yearMonth}-01`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}
