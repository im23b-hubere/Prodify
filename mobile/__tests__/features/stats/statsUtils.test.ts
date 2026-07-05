import { buildChartData, buildStatsSummary } from "../../../features/stats/utils/chartData";
import {
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
});

describe("stats summary utils", () => {
  it("builds summary from stats payload", () => {
    expect(
      buildStatsSummary({
        period: "week",
        summary: {
          total_seconds: 3600,
          total_sessions: 2,
          avg_session_seconds: 1800,
          current_streak_days: 3,
          best_streak_days: 5,
          hours_delta_vs_prior_period: 1.1,
        },
        trend: [],
        breakdown: [],
        recent_sessions: [],
        productivity_hint: null,
      }),
    ).toEqual({
      hours: "1.0h",
      sessions: "2",
      avgSession: "30m",
      streak: 3,
      bestStreak: 5,
      delta: 1.1,
    });
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
  it("prioritizes fresh current streak records", () => {
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
      ],
      now,
    );
    expect(decorated[0]?.key).toBe("current_streak");
    expect(decorated[0]?.isFresh).toBe(true);
  });
});
