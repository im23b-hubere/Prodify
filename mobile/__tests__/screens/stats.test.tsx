import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import StatsScreen from "../../app/(tabs)/stats";
import { localStatsDateKey } from "../../features/stats/utils/format";

const mockPush = jest.fn();

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useRouter: () => ({ push: mockPush, setParams: jest.fn() }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("react-native-reanimated", () => require("../../test/reanimatedStub"));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light" },
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, testID }: { children: React.ReactNode; testID?: string }) =>
      React.createElement(View, { testID }, children),
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
  subscribeSuccessfulMutations: jest.fn(() => () => undefined),
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

const { apiJson } = jest.requireMock("../../lib/client") as {
  apiJson: jest.Mock;
};

const STATS_STORY_ORDER = [
  "stats-week-hero",
  "stats-kpi-strip",
  "stats-section-trends",
  "stats-woran",
  "stats-skill-tree",
  "stats-section-recent",
  "stats-section-records",
] as const;

function collectTestIds(node: unknown, ids: string[] = []): string[] {
  if (!node || typeof node !== "object") return ids;
  const item = node as { props?: { testID?: string }; children?: unknown };
  if (typeof item.props?.testID === "string") ids.push(item.props.testID);
  if (Array.isArray(item.children)) {
    for (const child of item.children) collectTestIds(child, ids);
  }
  return ids;
}

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


  it("shows period filters and week hero after stats load", async () => {
    const { findByText, findByTestId } = render(<StatsScreen />);
    expect(await findByText("stats.filter7d")).toBeTruthy();
    expect(await findByTestId("stats-week-hero")).toBeTruthy();
    expect(await findByTestId("stats-kpi-strip")).toBeTruthy();
  });

  it("reads period hours first, then Woran, then the lifetime tree", async () => {
    const { findByTestId, toJSON } = render(<StatsScreen />);
    await findByTestId("stats-section-trends");
    await findByTestId("stats-woran");
    await findByTestId("stats-skill-tree");

    const wanted = new Set<string>(STATS_STORY_ORDER);
    const order = collectTestIds(toJSON()).filter((id) => wanted.has(id));
    expect(order).toEqual([...STATS_STORY_ORDER]);
  });

  it("fits thirty days of studio activity on one screen", async () => {
    const { findByText, findByTestId, toJSON } = render(<StatsScreen />);
    fireEvent.press(await findByText("stats.filter30d"));
    expect(await findByTestId("stats-chart-fit")).toBeTruthy();
    const cols = collectTestIds(toJSON()).filter((id) => id.startsWith("stats-chart-col-"));
    expect(cols).toHaveLength(30);
  });

  it("keeps hours over time and hides type mix and the studio read", async () => {
    const previous = apiJson.getMockImplementation()!;
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
          trend: [{ label: "2026-10-06", sessions: 2, seconds: 3600 }],
          breakdown: [{ session_type: "mixing", sessions: 3, percent: 75 }],
          recent_sessions: [],
          productivity_hint: "You often start around 9pm.",
        });
      }
      return previous(path);
    });
    const { findByTestId, queryByTestId, queryByText } = render(<StatsScreen />);

    expect(await findByTestId("stats-section-trends")).toBeTruthy();
    expect(await findByTestId("stats-woran")).toBeTruthy();
    expect(queryByTestId("stats-ai-insight")).toBeNull();
    expect(queryByText("stats.aiInsightLabel")).toBeNull();
    expect(queryByText("You often start around 9pm.")).toBeNull();
    expect(queryByText("stats.typeMixMeta")).toBeNull();
    expect(queryByText("stats.typeMixEmptyTitle")).toBeNull();
    expect(queryByText("sessionTypes.mixing")).toBeNull();
  });

  it("opens a tree branch from the period Woran row", async () => {
    const previous = apiJson.getMockImplementation()!;
    apiJson.mockImplementation((path: string) => {
      if (path.includes("/sessions/stats")) {
        return Promise.resolve({
          period: "week",
          summary: {
            total_seconds: 5400,
            total_sessions: 2,
            avg_session_seconds: 2700,
            current_streak_days: 1,
            best_streak_days: 1,
            hours_delta_vs_prior_period: null,
          },
          trend: [],
          breakdown: [],
          branch_seconds: [
            { branch: "mixing", seconds: 3600 },
            { branch: "beat_making", seconds: 1800 },
          ],
          recent_sessions: [],
          productivity_hint: null,
        });
      }
      return previous(path);
    });
    const { findByTestId, findByText } = render(<StatsScreen />);

    expect(await findByText("sessionTypes.mixing")).toBeTruthy();
    expect(await findByText("1h")).toBeTruthy();
    fireEvent.press(await findByTestId("stats-woran-mixing"));

    expect(mockPush).toHaveBeenCalledWith("/skill-tree?branch=mixing");
  });

  it("shows an empty Woran row when the period has no branch hours", async () => {
    const { findByTestId, findByText } = render(<StatsScreen />);

    expect(await findByTestId("stats-woran")).toBeTruthy();
    expect(await findByText("stats.woranEmptyTitle")).toBeTruthy();
  });

  it("shows the period average in the studio chart header", async () => {
    const { findByTestId, findByText } = render(<StatsScreen />);

    expect(await findByText("stats.chartAverage")).toBeTruthy();
    expect(await findByTestId("stats-chart-average")).toBeTruthy();
    expect(await findByTestId("stats-chart-range")).toBeTruthy();
    expect(await findByTestId("stats-chart-grid")).toBeTruthy();
  });

  it("puts a tapped day's hours in the chart header", async () => {
    const today = localStatsDateKey(new Date());
    const previous = apiJson.getMockImplementation()!;
    apiJson.mockImplementation((path: string) => {
      if (path.includes("/sessions/stats")) {
        return Promise.resolve({
          period: "week",
          summary: {
            total_seconds: 7200,
            total_sessions: 1,
            avg_session_seconds: 7200,
            current_streak_days: 1,
            best_streak_days: 1,
            hours_delta_vs_prior_period: null,
          },
          trend: [{ label: today, sessions: 1, seconds: 7200 }],
          breakdown: [],
          recent_sessions: [],
          productivity_hint: null,
        });
      }
      return previous(path);
    });
    const { findByTestId, findByText } = render(<StatsScreen />);

    fireEvent.press(await findByTestId(`stats-chart-col-${today}`));

    expect(await findByText("stats.chartHours")).toBeTruthy();
    expect((await findByTestId("stats-chart-average")).props.children).toBe("2h");
  });

  it("marks a hours-day best on the chart and names it after a tap", async () => {
    const today = localStatsDateKey(new Date());
    const previous = apiJson.getMockImplementation()!;
    apiJson.mockImplementation((path: string) => {
      if (path.includes("/sessions/stats")) {
        return Promise.resolve({
          period: "week",
          summary: {
            total_seconds: 7200,
            total_sessions: 1,
            avg_session_seconds: 7200,
            current_streak_days: 1,
            best_streak_days: 1,
            hours_delta_vs_prior_period: null,
          },
          trend: [{ label: today, sessions: 1, seconds: 7200 }],
          breakdown: [],
          recent_sessions: [],
          productivity_hint: null,
        });
      }
      if (path.includes("/stats/records")) {
        return Promise.resolve({
          records: [
            {
              key: "most_hours_day",
              label: "Most hours in one day",
              value: "2h 0m",
              context: today,
              occurred_at: today,
            },
          ],
        });
      }
      return previous(path);
    });
    const { findByTestId, findByText, queryByTestId } = render(<StatsScreen />);

    expect(await findByTestId(`stats-chart-record-${today}`)).toBeTruthy();
    expect(queryByTestId("stats-chart-record-caption")).toBeNull();

    fireEvent.press(await findByTestId(`stats-chart-col-${today}`));

    expect(await findByTestId("stats-chart-record-caption")).toBeTruthy();
    expect(await findByText("stats.recordMostHoursDay · 2h 0m")).toBeTruthy();
  });

  it("names a chart best only after choosing among several marked days", async () => {
    const today = localStatsDateKey(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setHours(0, 0, 0, 0);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = localStatsDateKey(yesterdayDate);
    const previous = apiJson.getMockImplementation()!;
    apiJson.mockImplementation((path: string) => {
      if (path.includes("/sessions/stats")) {
        return Promise.resolve({
          period: "week",
          summary: {
            total_seconds: 10800,
            total_sessions: 2,
            avg_session_seconds: 5400,
            current_streak_days: 1,
            best_streak_days: 1,
            hours_delta_vs_prior_period: null,
          },
          trend: [
            { label: yesterday, sessions: 1, seconds: 7200 },
            { label: today, sessions: 1, seconds: 3600 },
          ],
          breakdown: [],
          recent_sessions: [],
          productivity_hint: null,
        });
      }
      if (path.includes("/stats/records")) {
        return Promise.resolve({
          records: [
            {
              key: "most_hours_day",
              label: "Most hours in one day",
              value: "2h 0m",
              context: yesterday,
              occurred_at: yesterday,
            },
            {
              key: "longest_session",
              label: "Longest session",
              value: "1h 0m",
              context: "mixing",
              occurred_at: today,
            },
          ],
        });
      }
      return previous(path);
    });
    const { findByTestId, queryByTestId, findByText } = render(<StatsScreen />);

    expect(await findByTestId(`stats-chart-record-${today}`)).toBeTruthy();
    expect(await findByTestId(`stats-chart-record-${yesterday}`)).toBeTruthy();
    expect(queryByTestId("stats-chart-record-caption")).toBeNull();

    fireEvent.press(await findByTestId(`stats-chart-col-${today}`));

    expect(await findByTestId("stats-chart-record-caption")).toBeTruthy();
    expect(await findByText("stats.recordLongestSession · 1h 0m")).toBeTruthy();
  });

  it("opens the full skill tree from its stats card", async () => {
    const statsResponses = apiJson.getMockImplementation()!;
    apiJson.mockImplementation((path: string) =>
      path === "/skills/profile"
        ? Promise.resolve({ total_seconds: 0, branches: [], focuses: [] })
        : statsResponses(path),
    );
    const { findByTestId } = render(<StatsScreen />);

    fireEvent.press(await findByTestId("stats-skill-tree-open"));

    expect(mockPush).toHaveBeenCalledWith("/skill-tree");
  });

  it("keeps the rest of the stats usable when the skill tree fails to load", async () => {
    const { findByText, findByTestId } = render(<StatsScreen />);

    expect(await findByText("skillTree.loadError")).toBeTruthy();
    expect(await findByTestId("stats-kpi-strip")).toBeTruthy();
  });

  it("shows error state when stats load fails", async () => {
    apiJson.mockImplementation(async (path: string) => {
      if (path.includes("/sessions/stats")) throw new Error("Stats unavailable");
      if (path.includes("/stats/heatmap")) return [];
      if (path.includes("/stats/records")) return [];
      return null;
    });
    const { findByText, queryByTestId } = render(<StatsScreen />);
    expect(await findByText("Stats unavailable")).toBeTruthy();
    expect(queryByTestId("stats-kpi-strip")).toBeNull();
    expect(queryByTestId("stats-week-hero")).toBeNull();
  });
});
