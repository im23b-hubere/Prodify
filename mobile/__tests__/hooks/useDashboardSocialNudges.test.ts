import { renderHook } from "@testing-library/react-native";

import { useDashboardSocialNudges } from "../../features/dashboard/hooks/useDashboardSocialNudges";
import { mockTFunction } from "../helpers/mockTFunction";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/momentum", () => ({
  getMomentumSnapshot: jest.fn().mockResolvedValue({
    state: "mid",
    score: 50,
    lastAction: null,
  }),
  recordMomentumAction: jest.fn(),
}));

const mockT = mockTFunction();

describe("useDashboardSocialNudges", () => {
  it("leaves the weekly check-in rhythm out of the friends nudges", async () => {
    const { result } = renderHook(() =>
      useDashboardSocialNudges({
        userId: 1,
        friendActivity: [{ session_id: 1 } as never],
        buddyRisk: null,
        socialChallenges: [],
        commitmentStatus: null,
        checkinStatus: {
          week_start: "2026-06-30",
          target_checkins: 4,
          done_count: 1,
          on_track: false,
          day_states: [],
        },
        t: mockT,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(result.current.primaryNudge).toBeNull();
    expect(result.current.secondaryNudge).toBeNull();
  });
});
