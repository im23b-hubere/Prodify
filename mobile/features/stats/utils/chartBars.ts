import { localDateKey, startOfWeekMonday } from "../../../lib/weekCalendar";
import type { StatsPeriod } from "../types";

export type ChartBarTone = "today" | "active" | "empty";

export type TodayBarGrowth = {
  fromHours: number;
  toHours: number;
};

/** The bar that should feel alive after a session — today, or this week on lifetime. */
export function liveChartLabel(period: StatsPeriod, today = new Date()): string {
  if (period === "all") return localDateKey(startOfWeekMonday(today));
  return localDateKey(today);
}

export function chartBarTone(isLive: boolean, hours: number): ChartBarTone {
  if (isLive) return "today";
  if (hours > 0) return "active";
  return "empty";
}

/** Grow only when we already painted today and the hours just went up. */
export function todayBarGrowth(
  previousHours: number | null,
  nextHours: number,
): TodayBarGrowth | null {
  if (previousHours == null || nextHours <= previousHours) return null;
  return { fromHours: previousHours, toHours: nextHours };
}

export function barFillScale(hours: number, maxHours: number): number {
  if (maxHours <= 0 || hours <= 0) return 0;
  return Math.min(1, hours / maxHours);
}
