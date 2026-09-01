import React from "react";
import { render } from "@testing-library/react-native";

import { StatsScreenContent } from "../../../features/stats/components/StatsScreenContent";
import type { StatsScreenController } from "../../../features/stats/hooks/useStatsScreenController";

jest.mock("lucide-react-native", () => ({
  ChevronDown: () => null,
  ChevronUp: () => null,
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useSharedValue = (value: number) => ({ value });
  return Reanimated;
});

jest.mock("../../../features/stats/components/StatsHero", () => ({
  StatsHero: () => null,
}));
jest.mock("../../../features/stats/components/StatsTrendsSection", () => ({
  StatsTrendsSection: () => null,
}));
jest.mock("../../../features/stats/components/StatsSessionLogSection", () => ({
  StatsSessionLogSection: () => null,
}));
jest.mock("../../../features/stats/components/StatsRecordsSection", () => ({
  StatsRecordsSection: () => null,
}));
jest.mock("../../../features/stats/components/StatsHeatmapSection", () => ({
  StatsHeatmapSection: () => null,
}));
jest.mock("../../../features/weeklyRecap/WeeklyRecapTeaser", () => ({
  WeeklyRecapTeaser: () => null,
  isWeeklyRecapTeaserVisible: () => false,
}));

function createController(
  overrides: Partial<StatsScreenController> = {},
): StatsScreenController {
  return {
    t: ((key: string) => key) as StatsScreenController["t"],
    token: "token",
    filterIdx: 0,
    filters: [],
    filter: { key: "7d", label: "7d", period: "week" },
    stats: {
      period: "week",
      summary: {
        total_seconds: 3600,
        total_sessions: 2,
        avg_session_seconds: 1800,
        current_streak_days: 1,
        best_streak_days: 3,
        hours_delta_vs_prior_period: 0,
      },
      trend: [],
      breakdown: [],
      recent_sessions: [],
      productivity_hint: null,
    },
    progression: null,
    progressionSettled: false,
    loading: true,
    contentFade: { value: 1 } as unknown as StatsScreenController["contentFade"],
    openProgression: jest.fn(),
    startSession: jest.fn(),
    productivityHintText: null,
    chartData: [],
    breakdownData: [],
    recentSessions: [],
    decoratedRecords: [],
    heatmapDays: [],
    ...overrides,
  } as unknown as StatsScreenController;
}

describe("StatsScreenContent progression", () => {
  it("hides rank until progression data has settled", () => {
    const screen = render(
      <StatsScreenContent controller={createController({ progressionSettled: false })} />,
    );

    expect(screen.queryByTestId("progression-bar-loading")).toBeNull();
    expect(screen.queryByTestId("stats-section-progression")).toBeNull();
    expect(screen.queryByTestId("progression-bar-ready")).toBeNull();
  });

  it("shows unavailable progression after supplemental fetch settles without data", () => {
    const screen = render(
      <StatsScreenContent
        controller={createController({ progression: null, progressionSettled: true, loading: false })}
      />,
    );

    expect(screen.getByTestId("progression-bar-unavailable")).toBeTruthy();
    expect(screen.queryByText("0 XP total")).toBeNull();
  });

  it("shows real progression after supplemental data loads", () => {
    const screen = render(
      <StatsScreenContent
        controller={createController({
          progression: {
            xp_total: 0,
            current_level: 1,
            xp_to_next_level: 50,
            progress_percent: 0,
          },
          progressionSettled: true,
          loading: false,
        })}
      />,
    );

    expect(screen.getByTestId("progression-bar-ready")).toBeTruthy();
  });
});
