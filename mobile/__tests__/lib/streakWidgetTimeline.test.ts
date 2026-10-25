import {
  buildStreakWidgetTimeline,
  type StreakWidgetCopy,
  type StreakWidgetEntry,
} from "../../lib/streakWidgetTimeline";
import type { StreakOverviewDto } from "../../types/streak";

const copy: StreakWidgetCopy = {
  headline: (mood) => `headline:${mood}`,
  streakLabel: "DAY STREAK",
  weekdayLabels: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  accessibilityLabel: (streak, headline) => `${streak} days. ${headline}`,
};

/** Wednesday, 12 August 2026. */
const wednesdayAt = (hour: number, minute = 0) => new Date(2026, 7, 12, hour, minute);

function overview(partial: Partial<StreakOverviewDto> = {}): StreakOverviewDto {
  return {
    current_streak: 12,
    longest_streak: 20,
    last_7_day_states: ["session", "session", "session", "none", "none", "none", "none"],
    last_7_day_labels: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    next_milestone_at: 14,
    next_milestone_title: "Two weeks",
    days_to_next_milestone: 2,
    freezes_remaining: 1,
    can_use_freeze: false,
    streak_at_risk: false,
    tagline: "Keep the chain",
    ...partial,
  };
}

const atRiskToday = () =>
  overview({
    streak_at_risk: true,
    last_7_day_states: ["session", "session", "none", "none", "none", "none", "none"],
  });

const schedule = (entries: StreakWidgetEntry[]) =>
  entries.map((entry) => [entry.props.mood, entry.date.getDate(), entry.date.getHours()]);

const todayIndex = (entry: StreakWidgetEntry) => entry.props.week.findIndex((day) => day.isToday);

describe("buildStreakWidgetTimeline", () => {
  it("shows a single start entry when there is no streak to protect", () => {
    const entries = buildStreakWidgetTimeline(overview({ current_streak: 0 }), copy, wednesdayAt(10));

    expect(schedule(entries)).toEqual([["start", 12, 10]]);
  });

  it("shows an empty start entry when nobody is signed in", () => {
    const [entry] = buildStreakWidgetTimeline(null, copy, wednesdayAt(10));

    expect(entry.props.mood).toBe("start");
    expect(entry.props.week.every((day) => day.state === "none")).toBe(true);
  });

  it("keeps a secured streak until midnight and counts down through the next day", () => {
    const entries = buildStreakWidgetTimeline(overview(), copy, wednesdayAt(10));

    expect(schedule(entries)).toEqual([
      ["secured", 12, 10],
      ["pending", 13, 0],
      ["atRisk", 13, 18],
      ["lastChance", 13, 22],
      ["broken", 14, 0],
    ]);
  });

  it("predicts the break at midnight while today's session is still missing", () => {
    const entries = buildStreakWidgetTimeline(atRiskToday(), copy, wednesdayAt(10));

    expect(schedule(entries)).toEqual([
      ["pending", 12, 10],
      ["atRisk", 12, 18],
      ["lastChance", 12, 22],
      ["broken", 13, 0],
    ]);
  });

  it("starts at the current urgency when opened late in the evening", () => {
    const entries = buildStreakWidgetTimeline(atRiskToday(), copy, wednesdayAt(22, 30));

    expect(schedule(entries)).toEqual([
      ["lastChance", 12, 22],
      ["broken", 13, 0],
    ]);
  });

  it("drops the count to zero only once the streak is predicted to break", () => {
    const entries = buildStreakWidgetTimeline(atRiskToday(), copy, wednesdayAt(10));

    expect(entries.map((entry) => entry.props.streak)).toEqual([12, 12, 12, 0]);
  });

  it("moves today's marker forward in the week strip on each new day", () => {
    const [today, tomorrow] = buildStreakWidgetTimeline(overview(), copy, wednesdayAt(10));

    expect(todayIndex(today)).toBe(2);
    expect(todayIndex(tomorrow)).toBe(3);
    expect(tomorrow.props.week[2].state).toBe("session");
  });

  it("starts an empty week strip when the timeline crosses into a new week", () => {
    const sundayMorning = new Date(2026, 7, 16, 10, 0);
    const fullWeek = overview({ last_7_day_states: Array(7).fill("session") });

    const [, monday] = buildStreakWidgetTimeline(fullWeek, copy, sundayMorning);

    expect(todayIndex(monday)).toBe(0);
    expect(monday.props.week.every((day) => day.state === "none")).toBe(true);
  });

  it("describes each entry for VoiceOver with the count it shows", () => {
    const entries = buildStreakWidgetTimeline(atRiskToday(), copy, wednesdayAt(22, 30));

    expect(entries.map((entry) => entry.props.accessibilityLabel)).toEqual([
      "12 days. headline:lastChance",
      "0 days. headline:broken",
    ]);
  });

  it("uses the localized headline and labels for every entry", () => {
    const entries = buildStreakWidgetTimeline(overview(), copy, wednesdayAt(10));

    for (const entry of entries) {
      expect(entry.props.headline).toBe(`headline:${entry.props.mood}`);
      expect(entry.props.streakLabel).toBe("DAY STREAK");
      expect(entry.props.week.map((day) => day.label)).toEqual(copy.weekdayLabels);
    }
  });
});
