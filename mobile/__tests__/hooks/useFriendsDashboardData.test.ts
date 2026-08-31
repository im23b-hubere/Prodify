import { renderHook, waitFor } from "@testing-library/react-native";

import { resetFriendsAccountOwnedState } from "../../features/friends/hooks/friendsAuthReset";
import { useFriendsDashboardData } from "../../features/friends/hooks/useFriendsDashboardData";
import { useFriendsScreenState } from "../../features/friends/hooks/useFriendsScreenState";
import { loadFriendsDashboard } from "../../features/friends/services/friendsDashboardApi";
import type { FriendsDashboardSnapshot } from "../../features/friends/services/friendsDashboardApi";
import { mockTFunction } from "../helpers/mockTFunction";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(effect, [effect]);
  },
}));

jest.mock("../../features/friends/services/friendsDashboardApi", () => ({
  loadFriendsDashboard: jest.fn(),
}));

const mockLoadFriendsDashboard = loadFriendsDashboard as jest.MockedFunction<
  typeof loadFriendsDashboard
>;

const t = mockTFunction();

const userASnapshot = {
  leaderboard: {
    period: "week",
    entries: [
      {
        user_id: 10,
        username: "alice-friend",
        rank: 1,
        current_streak_days: 2,
        sessions_in_period: 3,
      },
    ],
  },
  activity: [
    {
      session_id: 101,
      user_id: 10,
      username: "alice-friend",
      session_type: "beat_making",
      activity_at: "2026-01-01T10:00:00Z",
      duration_seconds: 1800,
      reactions_count: 2,
      comments_count: 1,
    },
  ],
  incoming: [{ id: 1, user_id: 11, username: "requester-a", created_at: "2026-01-01T00:00:00Z" }],
  buddy: { status: "active" as const, buddy_user_id: 10, buddy_username: "alice-friend" },
  checkin: {
    week_start: "2026-01-01",
    target_checkins: 3,
    done_count: 2,
    on_track: true,
    day_states: [],
  },
  challenges: [
    {
      id: 1,
      owner_id: 1,
      challenge_kind: "duel",
      title: "User A challenge",
      week_start: "2026-01-01",
      target_sessions: 5,
      duration_days: 7,
      status: "active",
      members: [],
    },
  ],
  commitment: {
    week_start: "2026-01-01",
    target_sessions: 3,
    current_sessions: 1,
    status: "on_track" as const,
    visibility: "friends",
  },
  recap: {
    week_start: "2026-01-01",
    your_sessions: 4,
    buddy_sessions: 2,
    team_sessions: 6,
    wow_delta_sessions: 1,
  },
} satisfies FriendsDashboardSnapshot;

const userBSnapshot = {
  leaderboard: {
    period: "week",
    entries: [
      {
        user_id: 20,
        username: "bob-friend",
        rank: 1,
        current_streak_days: 5,
        sessions_in_period: 4,
      },
    ],
  },
  activity: [
    {
      session_id: 202,
      user_id: 20,
      username: "bob-friend",
      session_type: "mixing",
      activity_at: "2026-01-02T10:00:00Z",
      duration_seconds: 2400,
      reactions_count: 0,
      comments_count: 0,
    },
  ],
  incoming: [{ id: 2, user_id: 21, username: "requester-b", created_at: "2026-01-02T00:00:00Z" }],
  buddy: null,
  checkin: null,
  challenges: [],
  commitment: null,
  recap: null,
} satisfies FriendsDashboardSnapshot;

function renderFriendsDataHook(token: string | null, userId: number | null) {
  return renderHook(
    ({
      token: hookToken,
      userId: hookUserId,
    }: {
      token: string | null;
      userId: number | null;
    }) => {
      const state = useFriendsScreenState();
      const data = useFriendsDashboardData({
        token: hookToken,
        userId: hookUserId,
        periodParam: "week",
        t,
        state,
      });
      return { state, ...data };
    },
    { initialProps: { token, userId } },
  );
}

describe("resetFriendsAccountOwnedState", () => {
  it("clears leaderboard and all account-owned dashboard fields", () => {
    const state = {
      loadSeq: { current: 0 },
      setLeaderboard: jest.fn(),
      setActivity: jest.fn(),
      setIncoming: jest.fn(),
      setBuddy: jest.fn(),
      setCheckin: jest.fn(),
      setChallenges: jest.fn(),
      setCommitment: jest.fn(),
      setRecap: jest.fn(),
      setFeedMetricsBySession: jest.fn(),
      setEntitlement: jest.fn(),
      setError: jest.fn(),
      setRefreshing: jest.fn(),
      setLoading: jest.fn(),
      setAddName: jest.fn(),
      setReactionUsers: jest.fn(),
      setSelectedMembers: jest.fn(),
      setChallengeTitle: jest.fn(),
      setChallengeKind: jest.fn(),
      setChallengeTarget: jest.fn(),
      setChallengeDuration: jest.fn(),
      setAddOpen: jest.fn(),
      setReactionUsersOpen: jest.fn(),
      setChallengeCreateOpen: jest.fn(),
      setBuddyPickerOpen: jest.fn(),
      setActionBusy: jest.fn(),
      setAddBusy: jest.fn(),
      setChallengeCreateBusy: jest.fn(),
      setBusyActionKey: jest.fn(),
      setReactionUsersLoading: jest.fn(),
      setReactionBusyBySession: jest.fn(),
      setToastMessage: jest.fn(),
    } as unknown as ReturnType<typeof useFriendsScreenState>;

    resetFriendsAccountOwnedState(state, { token: null, userId: null });

    expect(state.loadSeq.current).toBe(1);
    expect(state.setLeaderboard).toHaveBeenCalledWith(null);
    expect(state.setActivity).toHaveBeenCalledWith([]);
    expect(state.setIncoming).toHaveBeenCalledWith([]);
    expect(state.setFeedMetricsBySession).toHaveBeenCalledWith({});
    expect(state.setLoading).toHaveBeenCalledWith(false);
  });
});

describe("useFriendsDashboardData auth scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadFriendsDashboard.mockResolvedValue(userASnapshot);
  });

  it("loads Friends data for the signed-in user", async () => {
    const { result } = renderFriendsDataHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.state.leaderboard).toEqual(userASnapshot.leaderboard);
    });

    expect(result.current.state.activity).toEqual(userASnapshot.activity);
    expect(result.current.state.incoming).toEqual(userASnapshot.incoming);
    expect(result.current.state.error).toBeNull();
  });

  it("clears all account-owned Friends data on sign-out", async () => {
    const { result, rerender } = renderFriendsDataHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.state.leaderboard).toEqual(userASnapshot.leaderboard);
    });

    result.current.state.setAddName("stale-name");
    result.current.state.setReactionUsers([
      { user_id: 99, username: "stale", emoji: "fire", created_at: "2026-01-01T00:00:00Z" },
    ]);

    rerender({ token: null, userId: null });

    expect(result.current.state.leaderboard).toBeNull();
    expect(result.current.state.activity).toEqual([]);
    expect(result.current.state.incoming).toEqual([]);
    expect(result.current.state.buddy).toBeNull();
    expect(result.current.state.checkin).toBeNull();
    expect(result.current.state.challenges).toEqual([]);
    expect(result.current.state.commitment).toBeNull();
    expect(result.current.state.recap).toBeNull();
    expect(result.current.state.feedMetricsBySession).toEqual({});
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.addName).toBe("");
    expect(result.current.state.reactionUsers).toEqual([]);
  });

  it("clears user A data before user B loads", async () => {
    const { result, rerender } = renderFriendsDataHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.state.leaderboard).toEqual(userASnapshot.leaderboard);
    });

    mockLoadFriendsDashboard.mockResolvedValue(userBSnapshot);
    rerender({ token: "token-b", userId: 2 });

    expect(result.current.state.leaderboard).toBeNull();
    expect(result.current.state.activity).toEqual([]);
    expect(result.current.state.incoming).toEqual([]);

    await waitFor(() => {
      expect(result.current.state.leaderboard).toEqual(userBSnapshot.leaderboard);
    });

    expect(result.current.state.incoming).toEqual(userBSnapshot.incoming);
  });

  it("does not skip user B load because of user A cache timestamp", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const { result, rerender } = renderFriendsDataHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.state.leaderboard).toEqual(userASnapshot.leaderboard);
    });

    expect(mockLoadFriendsDashboard).toHaveBeenCalledTimes(1);

    mockLoadFriendsDashboard.mockResolvedValue(userBSnapshot);
    rerender({ token: "token-b", userId: 2 });

    await waitFor(() => {
      expect(result.current.state.leaderboard).toEqual(userBSnapshot.leaderboard);
    });

    expect(mockLoadFriendsDashboard).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it("ignores stale user A responses after account switch", async () => {
    let staleResolve: ((value: FriendsDashboardSnapshot) => void) | undefined;
    mockLoadFriendsDashboard.mockImplementation(
      () =>
        new Promise((resolve) => {
          staleResolve = resolve;
        }),
    );

    const { result, rerender } = renderFriendsDataHook("token-a", 1);

    mockLoadFriendsDashboard.mockResolvedValue(userBSnapshot);
    rerender({ token: "token-b", userId: 2 });

    staleResolve?.(userASnapshot);
    await Promise.resolve();

    expect(result.current.state.leaderboard).toBeNull();
    expect(result.current.state.incoming).toEqual([]);

    await waitFor(() => {
      expect(result.current.state.leaderboard).toEqual(userBSnapshot.leaderboard);
    });
  });

  it("preserves Friends state and cache on same-user token refresh", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const { result, rerender } = renderFriendsDataHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.state.leaderboard).toEqual(userASnapshot.leaderboard);
    });

    mockLoadFriendsDashboard.mockClear();
    rerender({ token: "token-refreshed", userId: 1 });

    expect(result.current.state.leaderboard).toEqual(userASnapshot.leaderboard);
    expect(result.current.state.incoming).toEqual(userASnapshot.incoming);
    expect(mockLoadFriendsDashboard).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it("loads normally for a new user after reset", async () => {
    mockLoadFriendsDashboard.mockResolvedValue(userBSnapshot);

    const { result } = renderFriendsDataHook("token-b", 2);

    await waitFor(() => {
      expect(result.current.state.leaderboard).toEqual(userBSnapshot.leaderboard);
    });

    expect(result.current.state.activity).toEqual(userBSnapshot.activity);
    expect(result.current.state.error).toBeNull();
  });

  it("preserves leaderboard on same-user transient fetch failure", async () => {
    const { result } = renderFriendsDataHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.state.leaderboard).toEqual(userASnapshot.leaderboard);
    });

    mockLoadFriendsDashboard.mockReset();
    mockLoadFriendsDashboard.mockRejectedValue(new Error("network down"));

    await waitFor(async () => {
      await result.current.load({ force: true });
      expect(result.current.state.error).toBe("network down");
    });

    expect(result.current.state.leaderboard).toEqual(userASnapshot.leaderboard);
  });
});
