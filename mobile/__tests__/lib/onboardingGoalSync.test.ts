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

  it("syncs pending goal and clears storage on success", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("10");
    (apiJson as jest.Mock).mockResolvedValueOnce({
      goal_type: "weekly_sessions",
      target_value: 10,
      week_start: "2026-04-20",
      current_sessions: 0,
      progress_percent: 0,
    });

    await expect(syncPendingWeeklyGoal("token-123")).resolves.toBe(true);
    expect(apiJson).toHaveBeenCalledWith("/goals/set", {
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
});

