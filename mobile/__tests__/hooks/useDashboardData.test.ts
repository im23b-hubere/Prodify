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

jest.mock("../../lib/billing", () => ({
  fetchEntitlement: jest.fn().mockResolvedValue({ entitlement: "free", trial_active: false }),
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

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;
const mockFetchCurrentGoal = fetchCurrentGoal as jest.MockedFunction<typeof fetchCurrentGoal>;

describe("useDashboardData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockImplementation(async (path: string) => {
      if (path === "/sessions/list") return [];
      if (path === "/sessions/active") throw new Error("no active");
      if (path === "/streak/reconcile") return {};
      if (path === "/streak/overview") {
        return {
          current_streak: 0,
          best_streak: 0,
          streak_at_risk: false,
          freezes_remaining: 0,
        };
      }
      if (path === "/friends/leaderboard?period=week") return { entries: [] };
      if (path === "/friends/activity?limit=8") return [];
      return null;
    });
  });

  it("loads weekly goal via fetchCurrentGoal and exposes hasWeeklyGoal", async () => {
    mockFetchCurrentGoal.mockResolvedValue({
      goal_type: "weekly_sessions",
      target_value: 5,
      week_start: "2026-06-09",
      current_sessions: 2,
      progress_percent: 40,
    });

    const { result } = renderHook(() => useDashboardData("token"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchCurrentGoal).toHaveBeenCalledWith("token");
    expect(result.current.weeklyGoalTarget).toBe(5);
    expect(result.current.weekSessionsCount).toBe(2);
    expect(result.current.hasWeeklyGoal).toBe(true);
  });

  it("marks hasWeeklyGoal false when no goal exists", async () => {
    mockFetchCurrentGoal.mockResolvedValue(null);

    const { result } = renderHook(() => useDashboardData("token"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weeklyGoalTarget).toBeNull();
    expect(result.current.hasWeeklyGoal).toBe(false);
  });

  it("refreshes dashboard data on demand", async () => {
    mockFetchCurrentGoal.mockResolvedValue(null);

    const { result } = renderHook(() => useDashboardData("token"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callsBefore = mockFetchCurrentGoal.mock.calls.length;

    await act(async () => {
      await result.current.refreshDashboard({ force: true, withLoading: false });
    });

    expect(mockFetchCurrentGoal.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
