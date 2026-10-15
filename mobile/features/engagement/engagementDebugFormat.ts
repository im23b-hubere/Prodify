import type { EngagementDebug } from "../../lib/engagementDebug";

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const momentFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const MONDAY_UTC = Date.UTC(2026, 5, 8);
const DAY_MS = 24 * 60 * 60 * 1000;

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Weekdays come from the server as 0 = Monday. */
export function formatWeekday(weekday: number): string {
  return weekdayFormatter.format(new Date(MONDAY_UTC + weekday * DAY_MS));
}

export function formatWindow(window: EngagementDebug["production_window"]): string {
  const days =
    window.weekdays.length === 7 ? "Every day" : window.weekdays.map(formatWeekday).join(", ");
  return `${days} ${formatHour(window.start_hour)}–${formatHour(window.end_hour)}`;
}

export function formatMoment(iso: string): string {
  return momentFormatter.format(new Date(iso));
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Score parts that moved the total, biggest effect first. */
export function significantParts(parts: Record<string, number>): [string, number][] {
  return Object.entries(parts)
    .filter(([, value]) => value !== 0)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));
}
