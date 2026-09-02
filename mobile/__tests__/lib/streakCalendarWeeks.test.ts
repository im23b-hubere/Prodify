import {
  buildCalendarWeeksFromDays,
  resolveCalendarWeeks,
  weekStripTitle,
} from "../../lib/streakCalendarWeeks";
import type { StreakOverviewDto } from "../../types/streak";
import { mockTFunction } from "../helpers/mockTFunction";

const LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEDNESDAY = new Date(2026, 8, 2, 12, 0, 0);
const t = mockTFunction((key) => {
  if (key === "dashboard.weekStripThisWeek") return "This week";
  if (key === "dashboard.weekStripLastWeek") return "Last week";
  return key;
});

function overview(partial: Partial<StreakOverviewDto> = {}): StreakOverviewDto {
  return {
    current_streak: 1,
    longest_streak: 1,
    last_7_day_states: ["none", "none", "session", "none", "none", "none", "none"],
    last_7_day_labels: LABELS,
    next_milestone_at: 3,
    next_milestone_title: "Getting started",
    days_to_next_milestone: 2,
    freezes_remaining: 1,
    can_use_freeze: false,
    streak_at_risk: false,
    tagline: "Don't break the chain!",
    ...partial,
  };
}

describe("streakCalendarWeeks", () => {
  it("builds four Monday–Sunday weeks with today in the current week", () => {
    const weeks = buildCalendarWeeksFromDays(
      new Set(["2026-08-31", "2026-09-02"]),
      new Set(["2026-08-24"]),
      LABELS,
      WEDNESDAY,
    );

    expect(weeks).toHaveLength(4);
    expect(weeks.map((week) => week.offset)).toEqual([-3, -2, -1, 0]);
    expect(weeks[3]?.week_start).toBe("2026-08-31");
    expect(weeks[3]?.days[0]?.state).toBe("session");
    expect(weeks[3]?.days[2]?.is_today).toBe(true);
    expect(weeks[3]?.days[2]?.state).toBe("session");
    expect(weeks[3]?.days.map((day) => day.is_future)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(weeks[2]?.days[0]?.state).toBe("freeze");
  });

  it("uses local weekday labels and today, not ambiguous API letters", () => {
    const current = {
      week_start: "2026-08-31",
      offset: 0,
      days: [
        { date: "2026-08-31", label: "M", state: "none" as const, is_today: false, is_future: false },
        { date: "2026-09-01", label: "T", state: "none" as const, is_today: false, is_future: false },
        { date: "2026-09-02", label: "W", state: "session" as const, is_today: false, is_future: false },
        { date: "2026-09-03", label: "T", state: "none" as const, is_today: false, is_future: false },
        { date: "2026-09-04", label: "F", state: "none" as const, is_today: false, is_future: false },
        { date: "2026-09-05", label: "S", state: "none" as const, is_today: false, is_future: false },
        { date: "2026-09-06", label: "S", state: "none" as const, is_today: true, is_future: false },
      ],
    };
    const resolved = resolveCalendarWeeks(
      overview({ calendar_weeks: [current] }),
      [],
      LABELS,
      WEDNESDAY,
    );
    const days = resolved[0]?.days ?? [];

    expect(days.map((day) => day.label)).toEqual(LABELS);
    expect(days[2]?.is_today).toBe(true);
    expect(days[5]?.is_today).toBe(false);
    expect(days[5]?.is_future).toBe(true);
    expect(days[6]?.is_today).toBe(false);
    expect(days[6]?.label).toBe("Su");
  });

  it("prefers API calendar weeks over the last-7 fallback", () => {
    const apiWeeks = buildCalendarWeeksFromDays(new Set(["2026-08-24"]), new Set(), LABELS, WEDNESDAY);
    const resolved = resolveCalendarWeeks(
      overview({
        calendar_weeks: apiWeeks,
        last_7_day_states: ["session", "session", "session", "session", "session", "session", "session"],
      }),
      ["2026-09-02"],
      LABELS,
      WEDNESDAY,
    );

    expect(resolved).toEqual(apiWeeks);
    expect(resolved[2]?.days[0]?.state).toBe("session");
    expect(resolved[3]?.days[2]?.state).toBe("none");
  });

  it("expands a last-7 current week into four pager weeks", () => {
    const resolved = resolveCalendarWeeks(overview(), [], LABELS, WEDNESDAY);
    expect(resolved).toHaveLength(4);
    expect(resolved[3]?.days[2]?.state).toBe("session");
    expect(resolved[3]?.days[2]?.is_today).toBe(true);
    expect(resolved[0]?.offset).toBe(-3);
  });

  it("titles the current and previous weeks with copy, older weeks with a range", () => {
    const weeks = buildCalendarWeeksFromDays(new Set(), new Set(), LABELS, WEDNESDAY);
    expect(weekStripTitle(weeks[3]!, t)).toBe("This week");
    expect(weekStripTitle(weeks[2]!, t)).toBe("Last week");
    expect(weekStripTitle(weeks[1]!, t, "en-US")).toMatch(/Aug/);
  });
});
