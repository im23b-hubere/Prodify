import { act, renderHook } from "@testing-library/react-native";

import { useChallengeDraft } from "../../../features/challengeCreate/hooks/useChallengeDraft";
import type { SocialChallengeDto } from "../../../types/friends";

const friends = [
  { userId: 2, username: "bob", photoUri: null },
  { userId: 3, username: "carol", photoUri: null },
];

const pendingWithBob: SocialChallengeDto = {
  id: 9,
  owner_id: 1,
  invitee_user_id: 2,
  title: "eric vs bob",
  challenge_kind: "duel",
  week_start: "2026-09-28",
  target_sessions: 5,
  status: "pending",
  members: [],
};

type Options = Parameters<typeof useChallengeDraft>[0];

function renderDraft(overrides: Partial<Options> = {}) {
  return renderHook(() =>
    useChallengeDraft({ friends, challenges: [], userId: 1, yourName: "eric", ...overrides }),
  );
}

describe("useChallengeDraft", () => {
  it("cannot continue until a friend is picked", () => {
    const { result } = renderDraft();
    expect(result.current.stepIssue).toBe("pick_friend");
    act(() => result.current.dispatch({ type: "selectFriend", friendId: 3 }));
    expect(result.current.canContinue).toBe(true);
    expect(result.current.title).toBe("eric vs carol");
  });

  it("blocks a friend with an open invite", () => {
    const { result } = renderDraft({ challenges: [pendingWithBob] });
    expect(result.current.friendStatuses.get(2)).toBe("invite_pending");
    act(() => result.current.dispatch({ type: "selectFriend", friendId: 2 }));
    expect(result.current.stepIssue).toBe("invite_pending");
  });

  it("only exposes a request once the review step is valid", () => {
    const { result } = renderDraft({ initialFriendId: 3 });
    expect(result.current.request).toBeNull();
    act(() => result.current.dispatch({ type: "next" }));
    expect(result.current.request).toMatchObject({ title: "eric vs carol", member_user_ids: [3] });
  });
});
