import type { StreakRunDto } from "../../types/streak";

export function utcCalendarDateIso(dayOffset = 0, now = new Date()): string {
  const milliseconds = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + dayOffset,
  );
  return new Date(milliseconds).toISOString().slice(0, 10);
}

export function isActiveStreakRun(
  run: StreakRunDto,
  index: number,
  currentStreak: number | null,
  now = new Date(),
): boolean {
  if (currentStreak == null || currentStreak < 1 || index !== 0) return false;
  if (run.length_days !== currentStreak) return false;
  const today = utcCalendarDateIso(0, now);
  const yesterday = utcCalendarDateIso(-1, now);
  return run.end_date === today || run.end_date === yesterday;
}

export function formatStreakRange(startIso: string, endIso: string, locale?: string): string {
  try {
    const start = new Date(`${startIso}T12:00:00Z`);
    const end = new Date(`${endIso}T12:00:00Z`);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    if (startIso === endIso) return start.toLocaleDateString(locale, options);
    return `${start.toLocaleDateString(locale, options)} → ${end.toLocaleDateString(locale, options)}`;
  } catch {
    return `${startIso} → ${endIso}`;
  }
}
