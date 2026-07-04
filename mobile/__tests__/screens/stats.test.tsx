import React from "react";
import { render } from "@testing-library/react-native";

import StatsScreen from "../../app/(tabs)/stats";

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

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "Light" },
}));

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

describe("Stats Screen", () => {
  it("renders hero and KPI strip after load", async () => {
    const { findByTestId } = render(<StatsScreen />);
    expect(await findByTestId("your-week-hero")).toBeTruthy();
    expect(await findByTestId("stats-kpi-strip")).toBeTruthy();
  });

});
