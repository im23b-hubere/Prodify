/** Local calendar date key YYYY-MM-DD */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfWeekMonday(reference = new Date()): Date {
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(reference.getDate() + mondayOffset);
  return monday;
}

export function weekDateKeys(weekOffset = 0, reference = new Date()): string[] {
  const monday = startOfWeekMonday(reference);
  monday.setDate(monday.getDate() + weekOffset * 7);
  const keys: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    keys.push(localDateKey(d));
  }
  return keys;
}

/** Monday-start week: array of 7 local date keys for the current week */
export function currentWeekDateKeys(reference = new Date()): string[] {
  return weekDateKeys(0, reference);
}

export const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export const CALENDAR_WEEK_COUNT = 4;

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDaysIso(weekStartIso: string, days: number): string {
  const date = parseIsoDate(weekStartIso);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function formatWeekRangeLabel(weekStartIso: string, locale?: string): string {
  try {
    const start = parseIsoDate(weekStartIso);
    const end = parseIsoDate(addDaysIso(weekStartIso, 6));
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString(locale, options)} – ${end.toLocaleDateString(locale, options)}`;
  } catch {
    return weekStartIso;
  }
}
