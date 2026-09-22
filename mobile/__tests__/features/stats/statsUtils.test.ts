import { buildChartData, buildStatsSummary } from "../../../features/stats/utils/chartData";
import {
  buildHeatmapWeekGrid,
  countHeatmapActiveDays,
  getRecentHeatmapDays,
  hasRecentHeatmapActivity,
} from "../../../features/stats/utils/heatmap";
import { decorateRecords } from "../../../features/stats/utils/records";

describe("stats heatmap utils", () => {
  const days = [
    { date: "2026-07-01", seconds: 0, intensity: 0 },
    { date: "2026-07-02", seconds: 600, intensity: 2 },
    { date: "2026-07-03", seconds: 0, intensity: 0 },
    { date: "2026-07-04", seconds: 900, intensity: 3 },
  ];

  it("counts active heatmap days", () => {
    expect(countHeatmapActiveDays(days)).toBe(2);
  });

  it("returns recent heatmap slice", () => {
    expect(getRecentHeatmapDays(days, 2).map((day) => day.date)).toEqual([
      "2026-07-03",
      "2026-07-04",
    ]);
  });

  it("detects recent activity", () => {
    expect(hasRecentHeatmapActivity(days, 2)).toBe(true);
    expect(hasRecentHeatmapActivity([days[0], days[2]], 2)).toBe(false);
  });

  it("builds monday-start week columns", () => {
    const grid = buildHeatmapWeekGrid(days);
    expect(grid.length).toBeGreaterThanOrEqual(1);
    expect(grid[0]?.days).toHaveLength(7);
    expect(grid.flatMap((week) => week.days).some((day) => day?.date === "2026-07-02")).toBe(true);
  });

  it("starts the grid at the first full week instead of a lone leading day", () => {
    // 90 days ending Friday 2026-09-18 start on Sunday 2026-06-21.
    const ninetyDays = Array.from({ length: 90 }, (_, index) => {
      const date = new Date(2026, 5, 21 + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { date: key, seconds: 0, intensity: 0 };
    });

    const grid = buildHeatmapWeekGrid(ninetyDays);

    expect(grid[0]?.days.map((day) => day?.date)).toEqual([
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
    ]);
    expect(grid).toHaveLength(13);
    expect(grid[12]?.days.map((day) => day?.date ?? null)).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      null,
      null,
    ]);
  });
});

describe("stats summary utils", () => {
  it("builds summary with avg length and consistency", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const iso = (offset: number) => {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    expect(
      buildStatsSummary(
        {
          period: "week",
          summary: {
            total_seconds: 3600,
            total_sessions: 2,
            avg_session_seconds: 1800,
            current_streak_days: 3,
            best_streak_days: 5,
            hours_delta_vs_prior_period: 1.1,
          },
          trend: [
            { label: iso(-1), sessions: 1, seconds: 1800 },
            { label: iso(0), sessions: 1, seconds: 1800 },
          ],
          breakdown: [],
          recent_sessions: [],
          productivity_hint: null,
        },
        "week",
      ),
    ).toEqual({
      hours: "1.0h",
      sessions: "2",
      avgLength: "30m",
      consistencyPercent: 29,
      consistencyActiveDays: 2,
      consistencyTotalDays: 7,
      delta: 1.1,
    });
  });

  it("formats longer average sessions in hours", () => {
    expect(
      buildStatsSummary({
        period: "week",
        summary: {
          total_seconds: 7200,
          total_sessions: 1,
          avg_session_seconds: 5400,
          current_streak_days: 0,
          best_streak_days: 0,
          hours_delta_vs_prior_period: null,
        },
        trend: [],
        breakdown: [],
        recent_sessions: [],
        productivity_hint: null,
      }).avgLength,
    ).toBe("1h 30m");
  });

  it("builds week chart data with seven points", () => {
    const chart = buildChartData(
      {
        period: "week",
        summary: {
          total_seconds: 0,
          total_sessions: 0,
          avg_session_seconds: 0,
          current_streak_days: 0,
          best_streak_days: 0,
          hours_delta_vs_prior_period: null,
        },
        trend: [{ label: new Date().toISOString().slice(0, 10), sessions: 2, seconds: 7200 }],
        breakdown: [],
        recent_sessions: [],
        productivity_hint: null,
      },
      "week",
    );
    expect(chart).toHaveLength(7);
  });
});

describe("stats records utils", () => {
  it("keeps personal bests and drops current streak", () => {
    const now = Date.now();
    const decorated = decorateRecords(
      [
        {
          key: "longest_session",
          label: "Long",
          value: "2h",
          context: null,
          occurred_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          key: "current_streak",
          label: "Streak",
          value: "5d",
          context: null,
          occurred_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          key: "longest_streak",
          label: "Best streak",
          value: "12d",
          context: null,
          occurred_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      now,
    );
    expect(decorated.map((record) => record.key)).toEqual(["longest_streak", "longest_session"]);
    expect(decorated[0]?.isFresh).toBe(true);
  });
});
