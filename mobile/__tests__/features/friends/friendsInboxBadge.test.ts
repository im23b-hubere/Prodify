import { act, renderHook } from "@testing-library/react-native";

import {
  getIncomingFriendRequestCount,
  setIncomingFriendRequestCount,
  subscribeIncomingFriendRequestCount,
  useIncomingFriendRequestCount,
} from "../../../features/friends/sync/friendsInboxBadge";

describe("friendsInboxBadge", () => {
  beforeEach(() => setIncomingFriendRequestCount(0));

  it("notifies subscribers when the incoming count changes", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeIncomingFriendRequestCount(listener);

    setIncomingFriendRequestCount(2);
    setIncomingFriendRequestCount(2);
    unsubscribe();
    setIncomingFriendRequestCount(1);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(2);
    expect(getIncomingFriendRequestCount()).toBe(1);
  });

  it("exposes the live count to React via a hook", () => {
    const { result } = renderHook(() => useIncomingFriendRequestCount());
    expect(result.current).toBe(0);

    act(() => setIncomingFriendRequestCount(3));
    expect(result.current).toBe(3);
  });
});
