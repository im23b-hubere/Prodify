import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useDashboardData } from "../../features/dashboard/hooks/useDashboardData";
import { apiJson } from "../../lib/client";
import { fetchCurrentGoal } from "../../lib/goals";

const mockT = (key: string) => key;
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockT }),
}));

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

jest.mock("../../lib/goals", () => ({
  fetchCurrentGoal: jest.fn(),
}));

jest.mock("../../lib/social", () => ({
  fetchBuddyRisk: jest.fn().mockResolvedValue(null),
  fetchChallenges: jest.fn().mockResolvedValue([]),
  fetchCheckinStatus: jest.fn().mockResolvedValue(null),
  fetchCommitment: jest.fn().mockResolvedValue(null),
  fetchIdentityState: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../lib/sessionDto", () => ({
  parseSessionList: jest.fn(() => []),
  tryParseSessionDto: jest.fn(() => null),
}));

jest.mock("../../lib/streakNotifications", () => ({
  syncStreakRiskNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/weeklyRecapNotifications", () => ({
  syncWeeklyRecapReminder: jest.fn().mockResolvedValue(undefined),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;
const mockFetchCurrentGoal = fetchCurrentGoal as jest.MockedFunction<typeof fetchCurrentGoal>;

function mockDashboardApi({
  streak = 3,
  weeklyTarget = 5,
  weeklySessions = 2,
  socialLeaderboard = { entries: [{ user_id: 1, username: "alice", score: 10 }] },
}: {
  streak?: number;
  weeklyTarget?: number | null;
  weeklySessions?: number;
  socialLeaderboard?: { entries: Array<{ user_id: number; username: string; score: number }> } | null;
} = {}) {
  mockFetchCurrentGoal.mockResolvedValue(
    weeklyTarget == null
      ? null
      : {
          goal_type: "weekly_sessions",
          target_value: weeklyTarget,
          week_start: "2026-06-09",
          current_sessions: weeklySessions,
          progress_percent: 40,
        },
  );
  mockApiJson.mockImplementation(async (path: string) => {
    if (path === "/sessions/list?limit=200") return [];
    if (path === "/sessions/active") throw new Error("no active");
    if (path === "/streak/overview") {
      return {
        current_streak: streak,
        best_streak: streak,
        streak_at_risk: false,
        freezes_remaining: 0,
      };
    }
    if (path === "/friends/leaderboard?period=week") return socialLeaderboard;
    if (path === "/friends/activity?limit=8") return [];
    return null;
  });
}

describe("useDashboardData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDashboardApi();
  });

  it("loads weekly goal via fetchCurrentGoal and exposes hasWeeklyGoal", async () => {
    const { result } = renderHook(() => useDashboardData("token", 1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchCurrentGoal).toHaveBeenCalledWith("token");
    expect(result.current.weeklyGoalTarget).toBe(5);
    expect(result.current.weekSessionsCount).toBe(2);
    expect(result.current.hasWeeklyGoal).toBe(true);
  });

  it("marks hasWeeklyGoal false when no goal exists", async () => {
    mockDashboardApi({ weeklyTarget: null });

    const { result } = renderHook(() => useDashboardData("token", 1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weeklyGoalTarget).toBeNull();
    expect(result.current.hasWeeklyGoal).toBe(false);
  });

  it("refreshes dashboard data on demand", async () => {
    mockDashboardApi({ weeklyTarget: null });

    const { result } = renderHook(() => useDashboardData("token", 1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callsBefore = mockFetchCurrentGoal.mock.calls.length;

    await act(async () => {
      await result.current.refreshDashboard({ force: true, withLoading: false });
    });

    expect(mockFetchCurrentGoal.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("loads sessions with a higher list limit for streak fallbacks", async () => {
    mockDashboardApi({ weeklyTarget: null });

    renderHook(() => useDashboardData("token", 1));

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith("/sessions/list?limit=200", { token: "token" });
    });
  });

  it("stores social load failures separately from core dashboard errors", async () => {
    mockDashboardApi({ weeklyTarget: null });
    mockApiJson.mockImplementation(async (path: string) => {
      if (path === "/sessions/list?limit=200") return [];
      if (path === "/sessions/active") throw new Error("no active");
      if (path === "/streak/overview") {
        return {
          current_streak: 0,
          best_streak: 0,
          streak_at_risk: false,
          freezes_remaining: 0,
        };
      }
      if (path.startsWith("/friends/")) throw new Error("social down");
      return null;
    });

    const { result } = renderHook(() => useDashboardData("token", 1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.loadSocial();
    });

    expect(result.current.socialError).toBe("dashboard.socialLoadFailed");
    expect(result.current.error).toBeNull();
  });

  it("clears user A dashboard data when token becomes null", async () => {
    mockDashboardApi({ streak: 7, weeklyTarget: 4, weeklySessions: 1 });

    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useDashboardData(token, userId),
      { initialProps: { token: "token-a", userId: 1 } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.streakOverview?.current_streak).toBe(7);
    expect(result.current.weeklyGoalTarget).toBe(4);

    rerender({ token: null, userId: null });

    expect(result.current.streakOverview).toBeNull();
    expect(result.current.weeklyGoalTarget).toBeNull();
    expect(result.current.weekSessionsCount).toBe(0);
    expect(result.current.friendLeaderboard).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("clears user A dashboard data before user B data loads", async () => {
    mockDashboardApi({ streak: 9, weeklyTarget: 6, weeklySessions: 3 });

    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useDashboardData(token, userId),
      { initialProps: { token: "token-a", userId: 1 } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockDashboardApi({ streak: 1, weeklyTarget: 2, weeklySessions: 0 });
    rerender({ token: "token-b", userId: 2 });

    expect(result.current.streakOverview).toBeNull();
    expect(result.current.weeklyGoalTarget).toBeNull();
    expect(result.current.friendLeaderboard).toBeNull();
    expect(result.current.activeResolved).toBe(false);
    expect(result.current.loading).toBe(true);
  });

  it("does not wipe same-user data during token refresh", async () => {
    mockDashboardApi({ streak: 5, weeklyTarget: 3, weeklySessions: 1 });

    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useDashboardData(token, userId),
      { initialProps: { token: "token-a", userId: 1 } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    rerender({ token: "token-refreshed", userId: 1 });

    expect(result.current.streakOverview?.current_streak).toBe(5);
    expect(result.current.weeklyGoalTarget).toBe(3);
  });

  it("keeps existing weekly goal data when refresh fails for the same user", async () => {
    mockDashboardApi({ weeklyTarget: 4, weeklySessions: 2 });

    const { result } = renderHook(() => useDashboardData("token", 1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockFetchCurrentGoal.mockRejectedValueOnce(new Error("goal down"));

    await act(async () => {
      await result.current.loadWeeklyGoal();
    });

    expect(result.current.weeklyGoalTarget).toBe(4);
    expect(result.current.weekSessionsCount).toBe(2);
  });
});
