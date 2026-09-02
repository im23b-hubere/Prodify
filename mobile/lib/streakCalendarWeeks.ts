import type { TFunction } from "i18next";

import {
  CALENDAR_WEEK_COUNT,
  addDaysIso,
  formatWeekRangeLabel,
  localDateKey,
  weekDateKeys,
} from "./weekCalendar";
import type { StreakCalendarWeekDto, StreakDayKind, StreakOverviewDto } from "../types/streak";

const WEEKDAY_FALLBACK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function weekdayShortLabels(t: TFunction): string[] {
  const translated = t("dashboard.weekdayShort", { returnObjects: true }) as unknown;
  if (Array.isArray(translated) && translated.length === 7) {
    return translated.map((label) => String(label));
  }
  return WEEKDAY_FALLBACK;
}

export function weekStripTitle(
  week: StreakCalendarWeekDto,
  t: TFunction,
  locale?: string,
): string {
  if (week.offset === 0) return t("dashboard.weekStripThisWeek");
  if (week.offset === -1) return t("dashboard.weekStripLastWeek");
  return formatWeekRangeLabel(week.week_start, locale);
}

export function resolveCalendarWeeks(
  overview: StreakOverviewDto | null | undefined,
  sessionDays: Iterable<string>,
  labels: string[],
  now = new Date(),
): StreakCalendarWeekDto[] {
  const fromApi = parseCalendarWeeks(overview?.calendar_weeks);
  if (fromApi) return fromApi.map((week) => withLocalWeekPresentation(week, labels, now));
  if (overview) {
    const fromStrip = weekFromLastSeven(overview, labels, now);
    if (fromStrip) return expandWithEmptyPastWeeks(fromStrip, labels, now);
  }
  return buildCalendarWeeksFromDays(new Set(sessionDays), new Set(), labels, now);
}

function withLocalWeekPresentation(
  week: StreakCalendarWeekDto,
  labels: string[],
  now: Date,
): StreakCalendarWeekDto {
  const todayKey = localDateKey(now);
  return {
    ...week,
    days: week.days.map((day, index) => ({
      ...day,
      label: labels[index] ?? day.label,
      is_today: day.date === todayKey,
      is_future: day.date > todayKey,
    })),
  };
}

function parseCalendarWeeks(raw: StreakCalendarWeekDto[] | undefined): StreakCalendarWeekDto[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const weeks = raw
    .map(parseCalendarWeek)
    .filter((week): week is StreakCalendarWeekDto => week != null)
    .sort((a, b) => a.offset - b.offset);
  return weeks.length > 0 ? weeks : null;
}

function parseCalendarWeek(raw: StreakCalendarWeekDto): StreakCalendarWeekDto | null {
  if (!raw || typeof raw.week_start !== "string" || !Array.isArray(raw.days) || raw.days.length !== 7) {
    return null;
  }
  const days = raw.days.map((day, index) => ({
    date: typeof day?.date === "string" ? day.date : addDaysIso(raw.week_start, index),
    label: typeof day?.label === "string" ? day.label : "",
    state: parseDayKind(day?.state),
    is_today: Boolean(day?.is_today),
    is_future: Boolean(day?.is_future),
  }));
  return {
    week_start: raw.week_start,
    offset: typeof raw.offset === "number" ? raw.offset : 0,
    days,
  };
}

function weekFromLastSeven(
  overview: StreakOverviewDto,
  labels: string[],
  now: Date,
): StreakCalendarWeekDto | null {
  const states = overview.last_7_day_states;
  if (!Array.isArray(states) || states.length !== 7) return null;
  const keys = weekDateKeys(0, now);
  const todayKey = localDateKey(now);
  return {
    week_start: keys[0] ?? "",
    offset: 0,
    days: keys.map((date, index) => ({
      date,
      label: labels[index] ?? overview.last_7_day_labels?.[index] ?? "",
      state: parseDayKind(states[index]),
      is_today: date === todayKey,
      is_future: date > todayKey,
    })),
  };
}

function expandWithEmptyPastWeeks(
  current: StreakCalendarWeekDto,
  labels: string[],
  now: Date,
): StreakCalendarWeekDto[] {
  const weeks = buildCalendarWeeksFromDays(new Set(), new Set(), labels, now);
  return weeks.map((week) => (week.offset === 0 ? current : week));
}

export function buildCalendarWeeksFromDays(
  sessionDays: Set<string>,
  frozenDays: Set<string>,
  labels: string[],
  now = new Date(),
  weekCount = CALENDAR_WEEK_COUNT,
): StreakCalendarWeekDto[] {
  const todayKey = localDateKey(now);
  const count = Math.max(1, weekCount);
  const weeks: StreakCalendarWeekDto[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const offset = back === 0 ? 0 : -back;
    const keys = weekDateKeys(offset, now);
    weeks.push({
      week_start: keys[0] ?? "",
      offset,
      days: keys.map((date, index) => ({
        date,
        label: labels[index] ?? "",
        state: dayKind(date, sessionDays, frozenDays),
        is_today: date === todayKey,
        is_future: date > todayKey,
      })),
    });
  }
  return weeks;
}

function dayKind(
  date: string,
  sessionDays: Set<string>,
  frozenDays: Set<string>,
): StreakDayKind {
  if (sessionDays.has(date)) return "session";
  if (frozenDays.has(date)) return "freeze";
  return "none";
}

function parseDayKind(value: unknown): StreakDayKind {
  if (value === "session" || value === "freeze") return value;
  return "none";
}
