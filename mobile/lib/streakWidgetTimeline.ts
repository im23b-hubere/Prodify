import type { StreakDayKind, StreakOverviewDto } from "../types/streak";
import { localDateKey, weekDateKeys } from "./weekCalendar";

/** Same evening boundary the backend uses before it starts sending streak-risk pushes. */
const AT_RISK_HOUR = 18;
/** The first streak reminder of the night fires at this hour. */
const LAST_CHANCE_HOUR = 22;

export type StreakWidgetMood = "start" | "secured" | "pending" | "atRisk" | "lastChance" | "broken";

export type StreakWidgetDay = {
  label: string;
  state: StreakDayKind;
  isToday: boolean;
};

/** Everything the widget renders; it runs isolated from the app, so text arrives pre-localized. */
export type StreakWidgetProps = {
  streak: number;
  mood: StreakWidgetMood;
  headline: string;
  streakLabel: string;
  week: StreakWidgetDay[];
  accessibilityLabel: string;
};

export type StreakWidgetEntry = {
  date: Date;
  props: StreakWidgetProps;
};

export type StreakWidgetCopy = {
  headline: (mood: StreakWidgetMood) => string;
  streakLabel: string;
  weekdayLabels: string[];
  accessibilityLabel: (streak: number, headline: string) => string;
};

type PlannedMood = { date: Date; mood: StreakWidgetMood };

/**
 * Plans the widget ahead of time so it escalates through the evening and shows the break at
 * midnight even when the app never runs again — the system swaps entries on its own.
 * `overview` is null when nobody is signed in.
 */
export function buildStreakWidgetTimeline(
  overview: StreakOverviewDto | null,
  copy: StreakWidgetCopy,
  now = new Date(),
): StreakWidgetEntry[] {
  const streak = overview?.current_streak ?? 0;
  const knownDays = knownDayStates(overview, now);

  return planMoods(overview, now).map(({ date, mood }) => {
    const shownStreak = mood === "broken" ? 0 : streak;
    const headline = copy.headline(mood);
    return {
      date,
      props: {
        streak: shownStreak,
        mood,
        headline,
        streakLabel: copy.streakLabel,
        week: weekStrip(knownDays, copy.weekdayLabels, date),
        accessibilityLabel: copy.accessibilityLabel(shownStreak, headline),
      },
    };
  });
}

function planMoods(overview: StreakOverviewDto | null, now: Date): PlannedMood[] {
  if (!overview || overview.current_streak <= 0) return [{ date: now, mood: "start" }];
  if (overview.streak_at_risk) return dayCountdown(now, now);
  return [{ date: now, mood: "secured" }, ...dayCountdown(addDays(now, 1), now)];
}

/** The escalation for one day without a session, starting with whatever applies at `from`. */
function dayCountdown(day: Date, from: Date): PlannedMood[] {
  const steps: PlannedMood[] = [
    { date: atHour(day, 0), mood: "pending" },
    { date: atHour(day, AT_RISK_HOUR), mood: "atRisk" },
    { date: atHour(day, LAST_CHANCE_HOUR), mood: "lastChance" },
    { date: atHour(addDays(day, 1), 0), mood: "broken" },
  ];
  const current = steps.filter((step) => step.date <= from).pop();
  const upcoming = steps.filter((step) => step.date > from);
  return current ? [{ date: from, mood: current.mood }, ...upcoming] : upcoming;
}

function knownDayStates(overview: StreakOverviewDto | null, now: Date): Map<string, StreakDayKind> {
  const states = overview?.last_7_day_states ?? [];
  return new Map(weekDateKeys(0, now).map((key, index) => [key, states[index] ?? "none"]));
}

function weekStrip(
  knownDays: Map<string, StreakDayKind>,
  labels: string[],
  date: Date,
): StreakWidgetDay[] {
  const todayKey = localDateKey(date);
  return weekDateKeys(0, date).map((key, index) => ({
    label: labels[index] ?? "",
    state: knownDays.get(key) ?? "none",
    isToday: key === todayKey,
  }));
}

function atHour(day: Date, hour: number): Date {
  const date = new Date(day);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function addDays(day: Date, days: number): Date {
  const date = new Date(day);
  date.setDate(date.getDate() + days);
  return date;
}
