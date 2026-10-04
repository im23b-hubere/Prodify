import { describeChallengeCredit } from "../../../features/sessions/sessionChallengeCredits";
import type { SessionChallengeCreditDto } from "../../../types/friends";

const ME = 1;

function credit(overrides: Partial<SessionChallengeCreditDto>): SessionChallengeCreditDto {
  return {
    challenge_id: 4,
    challenge_kind: "duel",
    title: "Beat week",
    status: "active",
    credited: true,
    reason: null,
    progress_sessions: 3,
    target_sessions: 5,
    winner_user_id: null,
    is_tie: false,
    ...overrides,
  };
}

describe("describeChallengeCredit", () => {
  it("shows the new score when the session counted toward a running challenge", () => {
    expect(describeChallengeCredit(credit({}), ME)).toEqual({
      counted: true,
      key: "sessionComplete.challengeCreditCounted",
      params: { progress: 3, target: 5 },
    });
  });

  it("celebrates when this session decided the challenge in the user's favour", () => {
    const won = credit({ status: "completed", winner_user_id: ME });
    expect(describeChallengeCredit(won, ME).key).toBe("sessionComplete.challengeCreditWon");
  });

  it("names a tie and a loss distinctly", () => {
    const tied = credit({ status: "completed", is_tie: true });
    const lost = credit({ status: "completed", winner_user_id: 2 });
    expect(describeChallengeCredit(tied, ME).key).toBe("sessionComplete.challengeCreditTied");
    expect(describeChallengeCredit(lost, ME).key).toBe("sessionComplete.challengeCreditLost");
  });

  it.each([
    ["not_started", "sessionComplete.challengeSkipNotStarted"],
    ["too_short", "sessionComplete.challengeSkipTooShort"],
    ["before_start", "sessionComplete.challengeSkipBeforeStart"],
    ["after_end", "sessionComplete.challengeSkipAfterEnd"],
    ["already_finished", "sessionComplete.challengeSkipAlreadyFinished"],
    ["session_deleted", "sessionComplete.challengeSkipDeleted"],
  ] as const)("explains why the session did not count (%s)", (reason, key) => {
    const skipped = credit({ credited: false, reason });
    expect(describeChallengeCredit(skipped, ME)).toMatchObject({ counted: false, key });
  });
});
