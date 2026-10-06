import { buildChartData, buildStatsSummary } from "../../../features/stats/utils/chartData";
import { liveChartLabel } from "../../../features/stats/utils/chartBars";
import { chartShowsHourLabels } from "../../../features/stats/utils/chartScale";
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

describe("Studio activity scale", () => {
  it("fits the last 30 local days on one screen, including empty days", () => {
    const today = new Date(2026, 9, 6, 12, 0, 0);
    const chart = buildChartData(
      emptyStats({
        period: "month",
        trend: [
          { label: "2026-10-01", sessions: 2, seconds: 7200 },
          { label: "2026-09-20", sessions: 1, seconds: 1800 },
        ],
      }),
      "month",
      today,
    );

    expect(chart).toHaveLength(30);
    expect(chart[0]?.label).toBe("2026-09-07");
    expect(chart[chart.length - 1]?.label).toBe("2026-10-06");
    expect(chart.find((point) => point.label === "2026-10-01")?.y).toBe(2);
    expect(chart.find((point) => point.label === "2026-09-20")?.y).toBe(0.5);
    expect(chart.filter((point) => point.y === 0).length).toBeGreaterThan(20);
    expect(chart.filter((point) => point.x === "").length).toBeGreaterThan(15);
  });

  it("counts consistency against those 30 slots, not only days with sessions", () => {
    const today = new Date(2026, 9, 6, 12, 0, 0);
    const summary = buildStatsSummary(
      emptyStats({
        period: "month",
        summary: {
          total_seconds: 9000,
          total_sessions: 3,
          avg_session_seconds: 3000,
          current_streak_days: 1,
          best_streak_days: 1,
          hours_delta_vs_prior_period: null,
        },
        trend: [
          { label: "2026-10-01", sessions: 2, seconds: 7200 },
          { label: "2026-09-20", sessions: 1, seconds: 1800 },
        ],
      }),
      "month",
      today,
    );

    expect(summary.consistencyTotalDays).toBe(30);
    expect(summary.consistencyActiveDays).toBe(2);
  });

  it("keeps lifetime as weeks when the history still fits, including quiet weeks", () => {
    const today = new Date(2026, 0, 26, 12, 0, 0);
    const chart = buildChartData(
      emptyStats({
        period: "all",
        trend: [
          { label: "2026-01-05", sessions: 2, seconds: 7200 },
          { label: "2026-01-19", sessions: 1, seconds: 1800 },
        ],
      }),
      "all",
      today,
    );

    expect(chart.map((point) => ({ label: point.label, y: point.y }))).toEqual([
      { label: "2026-01-05", y: 2 },
      { label: "2026-01-12", y: 0 },
      { label: "2026-01-19", y: 0.5 },
      { label: "2026-01-26", y: 0 },
    ]);
  });

  it("folds lifetime into months once weeks would no longer fit", () => {
    const today = new Date(2026, 9, 6, 12, 0, 0);
    const chart = buildChartData(
      emptyStats({
        period: "all",
        trend: [
          { label: "2026-01-05", sessions: 2, seconds: 3600 },
          { label: "2026-01-12", sessions: 1, seconds: 3600 },
          { label: "2026-03-02", sessions: 1, seconds: 7200 },
        ],
      }),
      "all",
      today,
    );

    expect(chart[0]?.label).toBe("2026-01");
    expect(chart[chart.length - 1]?.label).toBe("2026-10");
    expect(chart).toHaveLength(10);
    expect(chart.find((point) => point.label === "2026-01")?.y).toBe(2);
    expect(chart.find((point) => point.label === "2026-03")?.y).toBe(2);
    expect(chart.find((point) => point.label === "2026-02")?.y).toBe(0);
  });

  it("labels Mondays in the 30-day view, like Health", () => {
    const today = new Date(2026, 9, 6, 12, 0, 0);
    const chart = buildChartData(emptyStats({ period: "month" }), "month", today);

    expect(chart.filter((point) => point.x !== "").map((point) => ({ label: point.label, x: point.x }))).toEqual([
      { label: "2026-09-07", x: "7" },
      { label: "2026-09-14", x: "14" },
      { label: "2026-09-21", x: "21" },
      { label: "2026-09-28", x: "28" },
      { label: "2026-10-05", x: "5" },
    ]);
  });

  it("uses a single letter for each month on the year-scale lifetime chart", () => {
    const today = new Date(2026, 9, 6, 12, 0, 0);
    const chart = buildChartData(
      emptyStats({
        period: "all",
        trend: [
          { label: "2026-01-05", sessions: 2, seconds: 3600 },
          { label: "2026-01-12", sessions: 1, seconds: 3600 },
          { label: "2026-03-02", sessions: 1, seconds: 7200 },
        ],
      }),
      "all",
      today,
    );

    expect(chart.map((point) => point.x)).toEqual(["J", "F", "M", "A", "M", "J", "J", "A", "S", "O"]);
  });

  it("never prints hours under the bars — the header carries the value", () => {
    expect(chartShowsHourLabels(1)).toBe(false);
    expect(chartShowsHourLabels(7)).toBe(false);
    expect(chartShowsHourLabels(30)).toBe(false);
  });

  it("grows the current month bar when lifetime is monthly", () => {
    expect(
      liveChartLabel("all", new Date(2026, 9, 6), [{ label: "2026-01" }, { label: "2026-10" }]),
    ).toBe("2026-10");
  });
});
