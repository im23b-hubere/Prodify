import {
  affectsChallenges,
  isChallengePushKind,
  requestChallengeSync,
  subscribeChallengeSync,
  syncChallengesOnWrites,
} from "../../../features/challenges/sync/challengeSync";
import { subscribeSuccessfulMutations } from "../../../lib/client";

jest.mock("../../../lib/client", () => ({
  subscribeSuccessfulMutations: jest.fn(),
}));

const mockSubscribeMutations = subscribeSuccessfulMutations as jest.MockedFunction<
  typeof subscribeSuccessfulMutations
>;

describe("affectsChallenges", () => {
  it("treats stopping, deleting and restoring a session as challenge changes", () => {
    expect(affectsChallenges({ path: "/sessions/stop", method: "POST" })).toBe(true);
    expect(affectsChallenges({ path: "/sessions/item/12", method: "DELETE" })).toBe(true);
    expect(affectsChallenges({ path: "/sessions/item/12/restore", method: "POST" })).toBe(true);
  });

  it("treats every challenge write as a change", () => {
    expect(affectsChallenges({ path: "/social/challenges/4/decline", method: "POST" })).toBe(true);
    expect(affectsChallenges({ path: "/social/challenges", method: "POST" })).toBe(true);
  });

  it("ignores writes that cannot move a score", () => {
    expect(affectsChallenges({ path: "/sessions/item/12", method: "PATCH" })).toBe(false);
    expect(affectsChallenges({ path: "/social/commitment", method: "POST" })).toBe(false);
  });
});

describe("isChallengePushKind", () => {
  it("recognizes duel and challenge pushes only", () => {
    expect(isChallengePushKind("duel_accepted")).toBe(true);
    expect(isChallengePushKind("challenge_won")).toBe(true);
    expect(isChallengePushKind("session_complete")).toBe(false);
    expect(isChallengePushKind(undefined)).toBe(false);
  });
});

describe("challenge sync", () => {
  it("tells every subscriber why it should refresh", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeChallengeSync(listener);

    requestChallengeSync("foreground");
    unsubscribe();
    requestChallengeSync();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("foreground");
  });

  it("asks screens to refresh after a session stop succeeded anywhere in the app", () => {
    mockSubscribeMutations.mockReturnValue(() => undefined);
    const listener = jest.fn();
    const unsubscribe = subscribeChallengeSync(listener);
    syncChallengesOnWrites();
    const onMutation = mockSubscribeMutations.mock.calls[0][0];

    onMutation({ path: "/sessions/stop", method: "POST" });
    onMutation({ path: "/users/me", method: "PATCH" });
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("changed");
  });
});
