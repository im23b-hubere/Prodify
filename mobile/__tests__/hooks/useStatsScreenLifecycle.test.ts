import { act, renderHook } from "@testing-library/react-native";

import { useStatsScreenLifecycle } from "../../features/stats/hooks/useStatsScreenLifecycle";
import { subscribeSuccessfulMutations } from "../../lib/client";

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(() => effect(), [effect]);
  },
}));

jest.mock("../../lib/client", () => ({
  subscribeSuccessfulMutations: jest.fn(() => () => undefined),
}));

const mockSubscribeMutations = subscribeSuccessfulMutations as jest.MockedFunction<
  typeof subscribeSuccessfulMutations
>;

describe("useStatsScreenLifecycle counted session writes", () => {
  it("force-reloads Stats after a session is stopped, deleted or restored", () => {
    const loadStats = jest.fn().mockResolvedValue(undefined);
    mockSubscribeMutations.mockReturnValue(() => undefined);

    renderHook(() =>
      useStatsScreenLifecycle({
        token: "token",
        periodParam: "week",
        showInitialLoading: false,
        loadStats,
        onFocusHandled: jest.fn(),
      }),
    );

    const onMutation = mockSubscribeMutations.mock.calls[0][0];
    loadStats.mockClear();

    act(() => {
      onMutation({ path: "/sessions/stop", method: "POST" });
      onMutation({ path: "/sessions/item/9", method: "DELETE" });
      onMutation({ path: "/sessions/item/9/restore", method: "POST" });
      onMutation({ path: "/social/challenges/3/join", method: "POST" });
    });

    expect(loadStats).toHaveBeenCalledTimes(3);
    expect(loadStats).toHaveBeenNthCalledWith(1, { force: true });
    expect(loadStats).toHaveBeenNthCalledWith(2, { force: true });
    expect(loadStats).toHaveBeenNthCalledWith(3, { force: true });
  });
});
