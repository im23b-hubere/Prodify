import { localDateKey } from "../../../lib/weekCalendar";
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

export type HeatmapWeekColumn = {
  days: Array<HeatmapDay | null>;
};

function parseDayKey(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function buildHeatmapWeekGrid(days: HeatmapDay[]): HeatmapWeekColumn[] {
  if (days.length === 0) return [];
  const byDate = new Map(days.map((day) => [day.date, day]));
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const first = parseDayKey(sorted[0].date);
  const last = parseDayKey(sorted[sorted.length - 1].date);
  if (!first || !last) return [];

  const start = new Date(first);
  const mondayOffset = start.getDay() === 0 ? -6 : 1 - start.getDay();
  start.setDate(start.getDate() + mondayOffset);

  const columns: HeatmapWeekColumn[] = [];
  const cursor = new Date(start);
  while (cursor <= last && columns.length < 16) {
    const week: Array<HeatmapDay | null> = [];
    for (let index = 0; index < 7; index += 1) {
      const key = localDateKey(cursor);
      if (cursor < first || cursor > last) {
        week.push(null);
      } else {
        week.push(byDate.get(key) ?? { date: key, seconds: 0, intensity: 0 });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push({ days: week });
  }
  return columns;
}
