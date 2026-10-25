import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useDashboardStreakData } from "../../features/dashboard/hooks/useDashboardStreakData";
import { apiJson } from "../../lib/client";
import { syncStreakRiskNotifications } from "../../lib/streakNotifications";
import { syncStreakWidget } from "../../lib/streakWidget";
import type { StreakOverviewDto } from "../../types/streak";

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

jest.mock("../../lib/streakNotifications", () => ({
  syncStreakRiskNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/streakWidget", () => ({
  syncStreakWidget: jest.fn(),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;
const mockSync = syncStreakRiskNotifications as jest.MockedFunction<typeof syncStreakRiskNotifications>;
const mockSyncWidget = syncStreakWidget as jest.MockedFunction<typeof syncStreakWidget>;

const savedOverview: StreakOverviewDto = {
  current_streak: 12,
  longest_streak: 20,
  last_7_day_states: ["session", "freeze", "session", "session", "session", "none", "none"],
  last_7_day_labels: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  freezes_remaining: 1,
  can_use_freeze: true,
  streak_at_risk: true,
  next_milestone_at: 14,
  next_milestone_title: "Two weeks",
  days_to_next_milestone: 2,
  tagline: "Keep the chain",
};

describe("useDashboardStreakData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps the last overview and marks it stale when a later refresh fails", async () => {
    mockApiJson.mockResolvedValueOnce(savedOverview);
    const { result } = renderHook(() => useDashboardStreakData("token", 1));

    await act(async () => {
      await result.current.loadStreakOverview();
    });

    mockApiJson.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await result.current.loadStreakOverview();
    });

    expect(result.current.streakOverview).toMatchObject({
      current_streak: 12,
      freezes_remaining: 1,
      can_use_freeze: true,
      streak_at_risk: true,
    });
    expect(result.current.streakOverviewStale).toBe(true);
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledWith(true, 12);
  });

  it("pushes every loaded overview to the home screen streak widget", async () => {
    mockApiJson.mockResolvedValueOnce(savedOverview);
    const { result } = renderHook(() => useDashboardStreakData("token", 1));

    await act(async () => {
      await result.current.loadStreakOverview();
    });

    expect(mockSyncWidget).toHaveBeenCalledWith(savedOverview);
  });

  it("keeps a loaded overview fresh when the widget cannot be updated", async () => {
    mockApiJson.mockResolvedValueOnce(savedOverview);
    mockSyncWidget.mockImplementationOnce(() => {
      throw new Error("no widget extension");
    });
    const { result } = renderHook(() => useDashboardStreakData("token", 1));

    await act(async () => {
      await result.current.loadStreakOverview();
    });

    expect(result.current.streakOverviewStale).toBe(false);
    expect(mockSync).toHaveBeenCalledWith(true, 12);
  });

  it("leaves the overview empty when the first load fails", async () => {
    mockApiJson.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useDashboardStreakData("token", 1));

    await act(async () => {
      await result.current.loadStreakOverview();
    });

    expect(result.current.streakOverview).toBeNull();
    expect(result.current.streakOverviewStale).toBe(true);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("replaces a stale overview when the next load succeeds", async () => {
    mockApiJson.mockResolvedValueOnce(savedOverview).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useDashboardStreakData("token", 1));

    await act(async () => {
      await result.current.loadStreakOverview();
    });
    await act(async () => {
      await result.current.loadStreakOverview();
    });
    expect(result.current.streakOverviewStale).toBe(true);

    mockApiJson.mockResolvedValueOnce({ ...savedOverview, current_streak: 13, streak_at_risk: false });
    await act(async () => {
      await result.current.loadStreakOverview();
    });

    await waitFor(() => {
      expect(result.current.streakOverviewStale).toBe(false);
    });
    expect(result.current.streakOverview?.current_streak).toBe(13);
    expect(result.current.streakOverview?.streak_at_risk).toBe(false);
  });

  it("clears a stale overview when the signed-in account goes away", async () => {
    mockApiJson.mockResolvedValueOnce(savedOverview).mockRejectedValueOnce(new Error("offline"));
    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useDashboardStreakData(token, userId),
      { initialProps: { token: "token", userId: 1 } },
    );

    await act(async () => {
      await result.current.loadStreakOverview();
    });
    await act(async () => {
      await result.current.loadStreakOverview();
    });
    expect(result.current.streakOverviewStale).toBe(true);

    rerender({ token: null, userId: null });

    await waitFor(() => {
      expect(result.current.streakOverview).toBeNull();
    });
    expect(result.current.streakOverviewStale).toBe(false);
  });
});
