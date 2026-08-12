import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { act, renderHook } from "@testing-library/react-native";

import { useDashboardStreakEvents } from "../../features/dashboard/hooks/useDashboardStreakEvents";
import { prependNotification } from "../../lib/notificationInbox";
import { latestNewMilestone } from "../../lib/streakMilestones";
import { mockTFunction } from "../helpers/mockTFunction";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: { Success: "success" },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../lib/notificationInbox", () => ({
  prependNotification: jest.fn().mockResolvedValue(undefined),
}));

const mockT = mockTFunction();
const refreshUnread = jest.fn();
const getItemAsync = jest.mocked(SecureStore.getItemAsync);
const setItemAsync = jest.mocked(SecureStore.setItemAsync);
type StreakEventsResult = ReturnType<typeof useDashboardStreakEvents>;
type StreakProps = { streak: number };

function overview(currentStreak: number) {
  return { current_streak: currentStreak } as never;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("dashboard streak events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getItemAsync.mockResolvedValue(null);
    setItemAsync.mockResolvedValue(undefined);
  });

  it("selects only the highest newly crossed milestone", () => {
    expect(latestNewMilestone(30, 7)?.days).toBe(30);
    expect(latestNewMilestone(7, 7)).toBeNull();
  });

  it("publishes one milestone event after initialization", async () => {
    const { result, rerender } = renderHook<StreakEventsResult, StreakProps>(
      ({ streak }) =>
        useDashboardStreakEvents({
          userId: 4,
          streakOverview: overview(streak),
          userScopedMilestoneKey: "milestone-4",
          userScopedStreakKey: "streak-4",
          t: mockT,
          refreshUnread,
        }),
      { initialProps: { streak: 6 } },
    );
    await flushEffects();
    getItemAsync.mockImplementation(async (key) => (key === "milestone-4" ? "6" : "7"));

    rerender({ streak: 7 });
    await flushEffects();

    expect(result.current.milestoneToast).toBe("One week warrior — Custom theme");
    expect(prependNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: "One week warrior — Custom theme" }),
    );
    expect(refreshUnread).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("opens and dismisses the break modal when a positive streak reaches zero", async () => {
    const { result, rerender } = renderHook<StreakEventsResult, StreakProps>(
      ({ streak }) =>
        useDashboardStreakEvents({
          userId: 8,
          streakOverview: overview(streak),
          userScopedMilestoneKey: "milestone-8",
          userScopedStreakKey: "streak-8",
          t: mockT,
          refreshUnread,
        }),
      { initialProps: { streak: 5 } },
    );
    await flushEffects();
    getItemAsync.mockImplementation(async (key) => (key === "streak-8" ? "5" : "5"));

    rerender({ streak: 0 });
    await flushEffects();

    expect(result.current.breakModalOpen).toBe(true);
    expect(result.current.breakModalStreak).toBe(5);
    act(result.current.dismissBreakModal);
    expect(result.current.breakModalOpen).toBe(false);
  });
});
