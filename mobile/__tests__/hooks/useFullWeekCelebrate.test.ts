import * as Haptics from "expo-haptics";
import { act, renderHook } from "@testing-library/react-native";

import { useFullWeekCelebrate } from "../../features/stats/hooks/useFullWeekCelebrate";
import {
  loadCelebratedFullWeek,
  saveCelebratedFullWeek,
} from "../../features/stats/fullWeekCelebrated";
import { weekDateKeys } from "../../lib/weekCalendar";

jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: { Success: "success" },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../features/stats/fullWeekCelebrated", () => ({
  loadCelebratedFullWeek: jest.fn(),
  saveCelebratedFullWeek: jest.fn().mockResolvedValue(undefined),
}));

const wednesday = new Date(2026, 0, 7, 15, 0, 0);
const thisWeek = weekDateKeys(0, wednesday);
const fullDays = thisWeek.map((date) => ({ date, seconds: 600, intensity: 2 }));

const loadCelebrated = loadCelebratedFullWeek as jest.MockedFunction<typeof loadCelebratedFullWeek>;
const saveCelebrated = saveCelebratedFullWeek as jest.MockedFunction<typeof saveCelebratedFullWeek>;

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useFullWeekCelebrate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadCelebrated.mockResolvedValue(null);
  });

  it("fires one success haptic the first time this week is full", async () => {
    const { rerender } = renderHook(
      ({ days }) => useFullWeekCelebrate(4, days, { today: wednesday }),
      { initialProps: { days: fullDays.slice(0, 6) } },
    );
    await flushEffects();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();

    rerender({ days: fullDays });
    await flushEffects();

    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
    expect(saveCelebrated).toHaveBeenCalledWith(4, thisWeek[0]);

    rerender({ days: fullDays });
    await flushEffects();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("does not fire again when this week was already celebrated", async () => {
    loadCelebrated.mockResolvedValue(thisWeek[0] ?? null);
    renderHook(() => useFullWeekCelebrate(4, fullDays, { today: wednesday }));
    await flushEffects();

    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(saveCelebrated).not.toHaveBeenCalled();
  });
});
