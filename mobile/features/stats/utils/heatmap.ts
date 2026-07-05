import { STATS_HEATMAP_RECENT_DAYS } from "../constants";
import type { HeatmapDay } from "../types";

export function countHeatmapActiveDays(days: HeatmapDay[]): number {
  return days.filter((day) => (day.intensity ?? 0) > 0 || (day.seconds ?? 0) > 0).length;
}

export function getRecentHeatmapDays(
  days: HeatmapDay[],
  count = STATS_HEATMAP_RECENT_DAYS,
): HeatmapDay[] {
  if (days.length <= count) return days;
  return days.slice(-count);
}

export function hasRecentHeatmapActivity(
  days: HeatmapDay[],
  count = STATS_HEATMAP_RECENT_DAYS,
): boolean {
  return getRecentHeatmapDays(days, count).some(
    (day) => (day.intensity ?? 0) > 0 || (day.seconds ?? 0) > 0,
  );
}
