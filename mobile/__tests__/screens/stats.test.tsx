import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import StatsScreen from "../../app/(tabs)/stats";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useSharedValue = (value: number) => ({ value });
  return Reanimated;
});

jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light" },
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({
      children,
      testID,
    }: {
      children: React.ReactNode;
      testID?: string;
    }) => React.createElement(View, { testID }, children),
  };
});

jest.mock("react-i18next", () => {
  const tFn = (key: string) => key;
  return {
    useTranslation: () => ({ t: tFn }),
  };
});

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token", user: { id: 1, username: "alice", is_premium: false } }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue("1"),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn().mockImplementation((path: string) => {
    if (path.includes("/sessions/stats")) {
      return Promise.resolve({
        period: "week",
        summary: {
          total_seconds: 7200,
          total_sessions: 4,
          avg_session_seconds: 1800,
          current_streak_days: 2,
          best_streak_days: 5,
          hours_delta_vs_prior_period: 1.2,
        },
        trend: [],
        breakdown: [],
        recent_sessions: [],
        productivity_hint: null,
      });
    }
    if (path.includes("/stats/heatmap")) return Promise.resolve([]);
    if (path.includes("/stats/records")) return Promise.resolve([]);
    if (path.includes("/outcomes/goal-forecast")) {
      return Promise.resolve({
        week_start: "2026-06-23",
        target_sessions: 5,
        completed_sessions: 2,
        remaining_sessions: 3,
        days_left: 4,
        required_sessions_per_day: 1,
        risk_level: "at_risk",
        warning_message: "Catch up",
      });
    }
    return Promise.resolve(null);
  }),
}));

jest.mock("../../lib/goals", () => ({
  fetchCurrentGoal: jest.fn().mockResolvedValue({
    goal_type: "weekly_sessions",
    target_value: 5,
    week_start: "2026-06-23",
    current_sessions: 2,
    progress_percent: 40,
  }),
  setWeeklyGoal: jest.fn(),
}));

jest.mock("../../lib/social", () => ({
  fetchCommitment: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../lib/progressionSync", () => ({
  fetchProgression: jest.fn().mockResolvedValue({
    xp_total: 100,
    current_level: 2,
    xp_to_next_level: 50,
    progress_percent: 40,
  }),
  syncProgression: jest.fn(),
}));

jest.mock("../../components/stats/YourWeekCard", () => ({
  YourWeekCard: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "your-week-hero" });
  },
}));

jest.mock("../../lib/screenDataStale", () => ({
  isScreenDataStale: () => false,
}));

jest.mock("../../components/progression/ProgressionBarCard", () => ({
  ProgressionBarCard: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View);
  },
}));

jest.mock("../../features/weeklyRecap/WeeklyRecapTeaser", () => ({
  WeeklyRecapTeaser: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "weekly-recap-teaser" });
  },
  isWeeklyRecapTeaserVisible: () => false,
}));

const { apiJson } = jest.requireMock("../../lib/client") as {
  apiJson: jest.Mock;
};

describe("Stats Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    apiJson.mockImplementation((path: string) => {
      if (path.includes("/sessions/stats")) {
        return Promise.resolve({
          period: "week",
          summary: {
            total_seconds: 7200,
            total_sessions: 4,
            avg_session_seconds: 1800,
            current_streak_days: 2,
            best_streak_days: 5,
            hours_delta_vs_prior_period: 1.2,
          },
          trend: [],
          breakdown: [],
          recent_sessions: [],
          productivity_hint: null,
        });
      }
      if (path.includes("/stats/heatmap")) return Promise.resolve([]);
      if (path.includes("/stats/records")) return Promise.resolve([]);
      if (path.includes("/outcomes/goal-forecast")) {
        return Promise.resolve({
          week_start: "2026-06-23",
          target_sessions: 5,
          completed_sessions: 2,
          remaining_sessions: 3,
          days_left: 4,
          required_sessions_per_day: 1,
          risk_level: "at_risk",
          warning_message: "Catch up",
        });
      }
      return Promise.resolve(null);
    });
  });

  it(
    "renders hero and KPI strip after load",
    async () => {
      const { findByTestId } = render(<StatsScreen />);
      expect(await findByTestId("your-week-hero")).toBeTruthy();
      expect(await findByTestId("stats-merged-hero")).toBeTruthy();
      expect(await findByTestId("stats-kpi-strip")).toBeTruthy();
    },
    15_000,
  );

  it("shows filter scope hint under period chips", async () => {
    const { findByText } = render(<StatsScreen />);
    expect(await findByText("stats.filterScopeHint")).toBeTruthy();
  });

  it("renders session log before records section", async () => {
    const { findByTestId } = render(<StatsScreen />);
    expect(await findByTestId("stats-section-recent")).toBeTruthy();
    expect(await findByTestId("stats-section-records")).toBeTruthy();
  });

  it("renders collapsed heatmap preview strip", async () => {
    const { findByTestId } = render(<StatsScreen />);
    expect(await findByTestId("stats-heatmap-preview")).toBeTruthy();
  });

  it("renders trends and progression sections", async () => {
    const { findByTestId } = render(<StatsScreen />);
    expect(await findByTestId("stats-section-trends")).toBeTruthy();
    expect(await findByTestId("stats-section-progression")).toBeTruthy();
  });

  it("shows all period filter chips", async () => {
    const { findByText } = render(<StatsScreen />);
    expect(await findByText("stats.filter7d")).toBeTruthy();
    expect(await findByText("stats.filter30d")).toBeTruthy();
    expect(await findByText("stats.filterAll")).toBeTruthy();
  });

  it("switches filter when a chip is pressed", async () => {
    const { findByText } = render(<StatsScreen />);
    fireEvent.press(await findByText("stats.filter30d"));
    await waitFor(() => {
      expect(apiJson).toHaveBeenCalledWith("/sessions/stats?period=month", { token: "token" });
    });
  });

  it("shows error state when stats load fails", async () => {
    apiJson.mockImplementation(async (path: string) => {
      if (path.includes("/sessions/stats")) throw new Error("Stats unavailable");
      if (path.includes("/stats/heatmap")) return [];
      if (path.includes("/stats/records")) return [];
      return null;
    });
    const { findByText } = render(<StatsScreen />);
    expect(await findByText("Stats unavailable")).toBeTruthy();
  });

  it("shows view-all link when session log exceeds preview", async () => {
    apiJson.mockImplementation(async (path: string) => {
      if (path.includes("/sessions/stats")) {
        return {
          summary: {
            total_seconds: 7200,
            total_sessions: 8,
            avg_session_seconds: 1800,
            current_streak_days: 2,
            best_streak_days: 5,
            hours_delta_vs_prior_period: 0,
          },
          trend: [],
          breakdown: [],
          recent_sessions: Array.from({ length: 8 }, (_, index) => ({
            id: index + 1,
            user_id: 1,
            started_at: "2026-07-01T10:00:00Z",
            stopped_at: "2026-07-01T11:00:00Z",
            duration_seconds: 3600,
            session_type: "beat_making",
            notes: null,
          })),
          productivity_hint: null,
        };
      }
      if (path.includes("/stats/heatmap")) return [];
      if (path.includes("/stats/records")) return [];
      return null;
    });
    const { findByText } = render(<StatsScreen />);
    expect(await findByText("stats.viewAllSessions")).toBeTruthy();
  });

  it("shows weekly recap fallback CTA when teaser is hidden", async () => {
    const { findByText } = render(<StatsScreen />);
    expect(await findByText("stats.openWeeklyRecap")).toBeTruthy();
  });
});
