import { buildChartData } from "../../../features/stats/utils/chartData";
import {
  buildChartHero,
  chartBarRangeLabel,
  chartYTicks,
} from "../../../features/stats/utils/chartHero";
import type { SessionStatsDto } from "../../../types/session";

function emptyStats(overrides: Partial<SessionStatsDto> = {}): SessionStatsDto {
  return {
    period: "week",
    summary: {
      total_seconds: 0,
      total_sessions: 0,
      avg_session_seconds: 0,
      current_streak_days: 0,
      best_streak_days: 0,
      hours_delta_vs_prior_period: null,
    },
    trend: [],
    breakdown: [],
    recent_sessions: [],
    productivity_hint: null,
    ...overrides,
  };
}

describe("Health-style studio chart header", () => {
  const today = new Date(2026, 9, 6, 12, 0, 0);

  it("states daily average hours and the visible date range for the week", () => {
    const stats = emptyStats({
      summary: {
        total_seconds: 25200,
        total_sessions: 7,
        avg_session_seconds: 3600,
        current_streak_days: 1,
        best_streak_days: 1,
        hours_delta_vs_prior_period: null,
      },
      trend: [{ label: "2026-10-06", sessions: 1, seconds: 7200 }],
    });
    const bars = buildChartData(stats, "week", today);
    const hero = buildChartHero(bars, "week", stats.summary.total_seconds, today);

    expect(hero.averageHours).toBe(1);
    expect(hero.averageKind).toBe("period");
    expect(hero.rangeLabel).toBe("Sep 30 – Oct 6, 2026");
  });

  it("labels longer buckets as average per day and spans the first bar to today", () => {
    const stats = emptyStats({
      period: "all",
      summary: {
        total_seconds: 279 * 3600,
        total_sessions: 4,
        avg_session_seconds: 3600,
        current_streak_days: 1,
        best_streak_days: 1,
        hours_delta_vs_prior_period: null,
      },
      trend: [
        { label: "2026-01-05", sessions: 2, seconds: 3600 },
        { label: "2026-01-12", sessions: 1, seconds: 3600 },
        { label: "2026-03-02", sessions: 1, seconds: 7200 },
      ],
    });
    const bars = buildChartData(stats, "all", today);
    const hero = buildChartHero(bars, "all", stats.summary.total_seconds, today);

    expect(hero.averageKind).toBe("perDay");
    expect(hero.averageHours).toBe(1);
    expect(hero.rangeLabel).toBe("Jan 2026 – Oct 2026");
  });

  it("names a tapped day, week, or month the way the header should read", () => {
    expect(chartBarRangeLabel({ x: "Tue", y: 2, label: "2026-10-06" }, "week")).toBe("Oct 6, 2026");
    expect(chartBarRangeLabel({ x: "Jan", y: 2, label: "2026-01-05" }, "all")).toBe(
      "Jan 5 – Jan 11, 2026",
    );
    expect(chartBarRangeLabel({ x: "O", y: 4, label: "2026-10" }, "all")).toBe("October 2026");
  });
});

describe("Health-style y scale", () => {
  it("leaves round headroom above the tallest bar", () => {
    expect(chartYTicks(0)).toEqual([0, 0.5, 1]);
    expect(chartYTicks(2)).toEqual([0, 1.5, 3]);
    expect(chartYTicks(8)).toEqual([0, 5, 10]);
    expect(chartYTicks(24)).toEqual([0, 15, 30]);
  });
});
