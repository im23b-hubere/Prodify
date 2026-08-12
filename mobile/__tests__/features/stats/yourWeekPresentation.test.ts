import {
  activeHeatmapDayKeys,
  goalProgressPercent,
  resolveGoalTarget,
  yourWeekStatus,
} from "../../../features/stats/yourWeekPresentation";
import type { GoalCurrentDto } from "../../../types/goals";

const goal = (overrides: Partial<GoalCurrentDto> = {}): GoalCurrentDto => ({
  goal_type: "weekly_sessions",
  target_value: 5,
  week_start: "2026-08-03",
  current_sessions: 2,
  progress_percent: 40,
  ...overrides,
});

describe("your week presentation", () => {
  it("classifies setup, completed and forecast risk states", () => {
    expect(yourWeekStatus(null, null, false)).toBe("setup");
    expect(yourWeekStatus(goal({ current_sessions: 5 }), null, true)).toBe("completed");
    expect(
      yourWeekStatus(
        goal(),
        {
          week_start: "2026-08-03",
          target_sessions: 5,
          completed_sessions: 2,
          remaining_sessions: 3,
          days_left: 2,
          required_sessions_per_day: 1.5,
          risk_level: "at_risk",
          warning_message: "",
        },
        true,
      ),
    ).toBe("behind");
  });

  it("clamps progress and validates custom targets", () => {
    expect(goalProgressPercent(goal({ progress_percent: 120 }))).toBe(100);
    expect(goalProgressPercent(goal({ progress_percent: -4 }))).toBe(0);
    expect(resolveGoalTarget("12", 5)).toBe(12);
    expect(resolveGoalTarget("51", 5)).toBeNull();
    expect(resolveGoalTarget("", 7)).toBe(7);
  });

  it("keeps only active heatmap days", () => {
    expect([
      ...activeHeatmapDayKeys([
        { date: "2026-08-03", seconds: 0, intensity: 0 },
        { date: "2026-08-04", seconds: 60, intensity: 0 },
        { date: "2026-08-05", seconds: 0, intensity: 2 },
      ]),
    ]).toEqual(["2026-08-04", "2026-08-05"]);
  });
});
