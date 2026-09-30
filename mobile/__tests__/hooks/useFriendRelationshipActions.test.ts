import { act, renderHook } from "@testing-library/react-native";
import { useState } from "react";

import { useFriendRelationshipActions } from "../../features/friends/hooks/useFriendRelationshipActions";
import type {
  FriendRequestsInFlight,
  FriendsScreenState,
} from "../../features/friends/hooks/useFriendsScreenState";

const mockApiJson = jest.fn();

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success" },
}));

type Deferred = { resolve: (value: unknown) => void };

function deferResponses() {
  const pending = new Map<string, Deferred>();
  mockApiJson.mockImplementation((path: string) => {
    if (path.endsWith("/post-accept-actions")) return Promise.resolve([]);
    return new Promise((resolve) => pending.set(path, { resolve }));
  });
  return pending;
}

function renderActions() {
  const load = jest.fn().mockResolvedValue(undefined);
  return renderHook(() => {
    const [requestsInFlight, setRequestsInFlight] = useState<FriendRequestsInFlight>({});
    const state = { requestsInFlight, setRequestsInFlight } as unknown as FriendsScreenState;
    const actions = useFriendRelationshipActions({
      token: "token",
      t: (key: string) => key,
      load,
      state,
    } as never);
    return { actions, requestsInFlight };
  });
}

describe("useFriendRelationshipActions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends one request when accept is tapped twice", async () => {
    const pending = deferResponses();
    const { result } = renderActions();

    act(() => {
      void result.current.actions.acceptRequest(42);
      void result.current.actions.acceptRequest(42);
    });

    expect(mockApiJson).toHaveBeenCalledTimes(1);
    expect(result.current.requestsInFlight).toEqual({ 42: "accept" });
    await act(async () => pending.get("/friends/42/accept")?.resolve({}));
    expect(result.current.requestsInFlight).toEqual({});
  });

  it("keeps each request's progress while two are answered at once", async () => {
    const pending = deferResponses();
    const { result } = renderActions();

    act(() => {
      void result.current.actions.acceptRequest(42);
      void result.current.actions.declineRequest(43);
    });
    expect(result.current.requestsInFlight).toEqual({ 42: "accept", 43: "decline" });

    await act(async () => pending.get("/friends/42/accept")?.resolve({}));
    expect(result.current.requestsInFlight).toEqual({ 43: "decline" });
  });
});
