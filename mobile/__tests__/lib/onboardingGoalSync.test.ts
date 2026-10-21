import AsyncStorage from "@react-native-async-storage/async-storage";

import { PENDING_WEEKLY_GOAL_KEY } from "../../constants/storageKeys";
import { apiJson } from "../../lib/client";
import { savePendingWeeklyGoal, syncPendingWeeklyGoal } from "../../lib/onboardingGoalSync";

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

describe("onboardingGoalSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores pending weekly goal locally", async () => {
    await savePendingWeeklyGoal(7);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(PENDING_WEEKLY_GOAL_KEY, "7");
  });

  it("drops a pending goal when this week is already configured", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("7");
    (apiJson as jest.Mock).mockResolvedValueOnce({
      goal_type: "weekly_sessions",
      target_value: 4,
      week_start: "2026-04-20",
      current_sessions: 1,
      progress_percent: 25,
      configured: true,
    });

    await expect(syncPendingWeeklyGoal("token-123")).resolves.toBe(false);
    expect(apiJson).toHaveBeenCalledTimes(1);
    expect(apiJson).toHaveBeenCalledWith("/goals/current", { token: "token-123" });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PENDING_WEEKLY_GOAL_KEY);
  });

  it("syncs pending goal and clears storage on success", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("10");
    (apiJson as jest.Mock)
      .mockResolvedValueOnce({
        goal_type: "weekly_sessions",
        target_value: 5,
        week_start: "2026-04-20",
        current_sessions: 0,
        progress_percent: 0,
        configured: false,
      })
      .mockResolvedValueOnce({
        goal_type: "weekly_sessions",
        target_value: 10,
        week_start: "2026-04-20",
        current_sessions: 0,
        progress_percent: 0,
        configured: true,
      });

    await expect(syncPendingWeeklyGoal("token-123")).resolves.toBe(true);
    expect(apiJson).toHaveBeenNthCalledWith(1, "/goals/current", { token: "token-123" });
    expect(apiJson).toHaveBeenNthCalledWith(2, "/goals/set", {
      token: "token-123",
      method: "POST",
      body: { goal_type: "weekly_sessions", target_value: 10 },
    });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PENDING_WEEKLY_GOAL_KEY);
  });

  it("does not call API when pending goal is missing or invalid", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await expect(syncPendingWeeklyGoal("token-123")).resolves.toBe(false);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("999");
    await expect(syncPendingWeeklyGoal("token-123")).resolves.toBe(false);

    expect(apiJson).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it("keeps the pending goal when saving it fails", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("7");
    (apiJson as jest.Mock)
      .mockResolvedValueOnce({
        goal_type: "weekly_sessions",
        target_value: 5,
        week_start: "2026-04-20",
        current_sessions: 0,
        progress_percent: 0,
        configured: false,
      })
      .mockRejectedValueOnce(new Error("payment required"));

    await expect(syncPendingWeeklyGoal("token-123")).rejects.toThrow("payment required");
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it("writes a pending goal once when two syncs overlap", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("7");
    let releaseCurrent: (value: unknown) => void = () => undefined;
    const currentGoal = new Promise((resolve) => {
      releaseCurrent = resolve;
    });
    (apiJson as jest.Mock).mockImplementation((path: string) => {
      if (path === "/goals/current") return currentGoal;
      return Promise.resolve({
        goal_type: "weekly_sessions",
        target_value: 7,
        week_start: "2026-04-20",
        current_sessions: 0,
        progress_percent: 0,
        configured: true,
      });
    });

    const first = syncPendingWeeklyGoal("token-123");
    const second = syncPendingWeeklyGoal("token-123");

    expect(first).toBe(second);
    releaseCurrent({
      goal_type: "weekly_sessions",
      target_value: 5,
      week_start: "2026-04-20",
      current_sessions: 0,
      progress_percent: 0,
      configured: false,
    });

    await expect(first).resolves.toBe(true);
    const posts = (apiJson as jest.Mock).mock.calls.filter(([path]) => path === "/goals/set");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.[1]).toMatchObject({
      method: "POST",
      body: { goal_type: "weekly_sessions", target_value: 7 },
    });
  });
});
