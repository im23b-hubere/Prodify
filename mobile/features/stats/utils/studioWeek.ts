import { MINIMUM_COUNTED_SESSION_SECONDS } from "../../sessions/sessionCompletePresentation";
import { weekDateKeys } from "../../../lib/weekCalendar";

type DaySeconds = { date: string; seconds?: number };

export function countedStudioDayKeys(
  days: DaySeconds[],
  minSeconds = MINIMUM_COUNTED_SESSION_SECONDS,
): Set<string> {
  return new Set(days.filter((day) => (day.seconds ?? 0) >= minSeconds).map((day) => day.date));
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

/** Newest full week that has not been celebrated yet — this week first, then last week. */
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
    if (celebratedWeekStart === weekStart) continue;
    return weekStart;
  }
  return null;
}
