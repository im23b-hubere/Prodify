import { weekDateKeys } from "../../../lib/weekCalendar";

type DaySeconds = { date: string; counted?: boolean };

export function countedStudioDayKeys(days: DaySeconds[]): Set<string> {
  return new Set(days.filter((day) => day.counted === true).map((day) => day.date));
}

export function studioWeekFill(days: DaySeconds[], weekKeys: string[]) {
  const counted = countedStudioDayKeys(days);
  const filledKeys = new Set(weekKeys.filter((key) => counted.has(key)));
  return {
    filledKeys,
    filledCount: filledKeys.size,
    isComplete: weekKeys.length === 7 && filledKeys.size === 7,
  };
}

/**
 * The newest full week (this week, else last week) if it has not been celebrated yet.
 * Only the newest one counts: falling back to an older week after celebrating the newer one
 * would make two full weeks in a row take turns being celebrated on every visit.
 */
export function uncelebratedFullWeekStart(
  days: DaySeconds[],
  celebratedWeekStart: string | null,
  storageReady: boolean,
  today = new Date(),
): string | null {
  if (!storageReady) return null;
  for (const offset of [0, -1]) {
    const keys = weekDateKeys(offset, today);
    const weekStart = keys[0];
    if (!weekStart || !studioWeekFill(days, keys).isComplete) continue;
    return celebratedWeekStart === weekStart ? null : weekStart;
  }
  return null;
}
