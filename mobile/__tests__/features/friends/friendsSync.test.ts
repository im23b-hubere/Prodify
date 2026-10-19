import {
  affectsFriends,
  isFriendPushKind,
  requestFriendsSync,
  subscribeFriendsSync,
  syncFriendsOnWrites,
} from "../../../features/friends/sync/friendsSync";
import { subscribeSuccessfulMutations } from "../../../lib/client";

jest.mock("../../../lib/client", () => ({
  subscribeSuccessfulMutations: jest.fn(),
}));

const mockSubscribeMutations = subscribeSuccessfulMutations as jest.MockedFunction<
  typeof subscribeSuccessfulMutations
>;

describe("affectsFriends", () => {
  it("treats every friends write as a change", () => {
    expect(affectsFriends({ path: "/friends/request", method: "POST" })).toBe(true);
    expect(affectsFriends({ path: "/friends/12/accept", method: "POST" })).toBe(true);
    expect(affectsFriends({ path: "/friends/12", method: "DELETE" })).toBe(true);
  });

  it("treats blocking a user as a friendship change", () => {
    expect(affectsFriends({ path: "/users/7/block", method: "POST" })).toBe(true);
    expect(affectsFriends({ path: "/users/7/block", method: "DELETE" })).toBe(true);
  });

  it("ignores unrelated writes", () => {
    expect(affectsFriends({ path: "/friends/leaderboard", method: "GET" })).toBe(false);
    expect(affectsFriends({ path: "/users/me", method: "PATCH" })).toBe(false);
    expect(affectsFriends({ path: "/social/challenges", method: "POST" })).toBe(false);
  });
});

describe("isFriendPushKind", () => {
  it("recognizes friend request and accept pushes only", () => {
    expect(isFriendPushKind("friend_request")).toBe(true);
    expect(isFriendPushKind("friend_accepted")).toBe(true);
    expect(isFriendPushKind("friend_nudge")).toBe(false);
    expect(isFriendPushKind("duel_invite")).toBe(false);
    expect(isFriendPushKind(undefined)).toBe(false);
  });
});

describe("friends sync", () => {
  it("tells every subscriber why it should refresh", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeFriendsSync(listener);

    requestFriendsSync("foreground");
    unsubscribe();
    requestFriendsSync();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("foreground");
  });

  it("asks screens to refresh after a friend write succeeded anywhere in the app", () => {
    mockSubscribeMutations.mockReturnValue(() => undefined);
    const listener = jest.fn();
    const unsubscribe = subscribeFriendsSync(listener);
    syncFriendsOnWrites();
    const onMutation = mockSubscribeMutations.mock.calls[0][0];

    onMutation({ path: "/friends/request", method: "POST" });
    onMutation({ path: "/users/me", method: "PATCH" });
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("changed");
  });
});
