import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { Alert } from "react-native";

import { useFriendRelationshipActions } from "../../features/friends/hooks/useFriendRelationshipActions";
import type {
  FriendRequestsInFlight,
  FriendsScreenState,
} from "../../features/friends/hooks/useFriendsScreenState";
import {
  getIncomingFriendRequestCount,
  setIncomingFriendRequestCount,
} from "../../features/friends/sync/friendsInboxBadge";
import type { FriendIncomingDto } from "../../types/friends";

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

type Deferred = { resolve: (value: unknown) => void; reject: (error: unknown) => void };

function deferResponses() {
  const pending = new Map<string, Deferred>();
  mockApiJson.mockImplementation((path: string) => {
    if (path.endsWith("/post-accept-actions")) return Promise.resolve([]);
    return new Promise((resolve, reject) => pending.set(path, { resolve, reject }));
  });
  return pending;
}

const requestA: FriendIncomingDto = {
  id: 42,
  user_id: 3,
  username: "carol",
  profile_picture_url: null,
  created_at: "2026-01-01T00:00:00Z",
};
const requestB: FriendIncomingDto = {
  id: 43,
  user_id: 4,
  username: "dave",
  profile_picture_url: null,
  created_at: "2026-01-01T00:00:00Z",
};

function renderActions(initialIncoming: FriendIncomingDto[] = [requestA, requestB]) {
  const load = jest.fn().mockResolvedValue(undefined);
  return renderHook(() => {
    const [requestsInFlight, setRequestsInFlight] = useState<FriendRequestsInFlight>({});
    const [incoming, setIncoming] = useState(initialIncoming);
    const state = {
      incoming,
      setIncoming,
      requestsInFlight,
      setRequestsInFlight,
    } as unknown as FriendsScreenState;
    const actions = useFriendRelationshipActions({
      token: "token",
      t: (key: string) => key,
      load,
      state,
    } as never);
    return { actions, requestsInFlight, incoming, load };
  });
}

function renderSendActions(addBusy = false) {
  const load = jest.fn().mockResolvedValue(undefined);
  return renderHook(() => {
    const [requestsInFlight, setRequestsInFlight] = useState<FriendRequestsInFlight>({});
    const [busy, setAddBusy] = useState(addBusy);
    const [incoming, setIncoming] = useState<FriendIncomingDto[]>([]);
    const state = {
      addName: "bob",
      setAddName: jest.fn(),
      setAddOpen: jest.fn(),
      addBusy: busy,
      setAddBusy,
      incoming,
      setIncoming,
      requestsInFlight,
      setRequestsInFlight,
    } as unknown as FriendsScreenState;
    const actions = useFriendRelationshipActions({
      token: "token",
      t: (key: string) => key,
      load,
      state,
    } as never);
    return { actions, load, setAddBusy };
  });
}

describe("useFriendRelationshipActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setIncomingFriendRequestCount(0);
  });

  it("ignores a second send while the first request is still in flight", async () => {
    const pending = deferResponses();
    const { result } = renderSendActions();

    act(() => {
      void result.current.actions.sendRequest();
      void result.current.actions.sendRequest();
    });

    expect(mockApiJson).toHaveBeenCalledTimes(1);
    await act(async () => pending.get("/friends/request")?.resolve({}));
    expect(result.current.load).toHaveBeenCalledWith({ force: true });
  });

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

  it("removes the request from the inbox immediately and reloads when accept fails", async () => {
    const pending = deferResponses();
    const { result } = renderActions();

    act(() => {
      void result.current.actions.acceptRequest(42);
    });
    expect(result.current.incoming.map((row) => row.id)).toEqual([43]);
    expect(getIncomingFriendRequestCount()).toBe(1);

    await act(async () => pending.get("/friends/42/accept")?.reject(new Error("offline")));
    expect(result.current.load).toHaveBeenCalledWith({ force: true });
  });

  it("keeps each request out of the inbox when two are answered at once", async () => {
    const pending = deferResponses();
    const { result } = renderActions();

    act(() => {
      void result.current.actions.acceptRequest(42);
      void result.current.actions.declineRequest(43);
    });
    expect(result.current.requestsInFlight).toEqual({ 42: "accept", 43: "decline" });
    expect(result.current.incoming).toEqual([]);
    expect(getIncomingFriendRequestCount()).toBe(0);

    await act(async () => {
      pending.get("/friends/42/accept")?.resolve({});
      pending.get("/friends/43")?.resolve({});
    });
    expect(result.current.incoming).toEqual([]);
  });

  it("declines and blocks the sender after confirming", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === "destructive")?.onPress?.();
    });
    mockApiJson.mockResolvedValue(null);
    const { result } = renderActions();

    act(() => result.current.actions.declineAndBlock({ user_id: 3, username: "carol" }));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith("/users/3/block", { token: "token", method: "POST" }),
    );
    jest.restoreAllMocks();
  });
});
