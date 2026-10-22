import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useStreakHistory } from "../../../features/streak/hooks/useStreakHistory";
import { apiJson } from "../../../lib/client";

jest.mock("../../../lib/client", () => ({
  apiJson: jest.fn(),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

const runs = [{ start_date: "2026-10-11", end_date: "2026-10-22", length_days: 12 }];

describe("useStreakHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps the last streak number when a refresh cannot load the overview", async () => {
    mockApiJson.mockImplementation(async (path: string) => {
      if (String(path).startsWith("/streak/history")) return runs;
      if (path === "/streak/overview") return { current_streak: 12 };
      throw new Error(String(path));
    });
    const { result } = renderHook(() => useStreakHistory("token", "fallback"));

    await waitFor(() => {
      expect(result.current.currentStreak).toBe(12);
    });

    mockApiJson.mockImplementation(async (path: string) => {
      if (String(path).startsWith("/streak/history")) return runs;
      if (path === "/streak/overview") throw new Error("offline");
      throw new Error(String(path));
    });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
    expect(result.current.currentStreak).toBe(12);
    expect(result.current.runs).toEqual(runs);
    expect(result.current.error).toBeNull();
  });
});