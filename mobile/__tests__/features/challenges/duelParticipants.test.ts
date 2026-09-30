import { duelParticipants } from "../../../features/challenges/duelParticipants";
import type { SocialChallengeDto } from "../../../types/friends";

function challengeWith(members: [number, number][]): SocialChallengeDto {
  return {
    id: 1,
    owner_id: 1,
    challenge_kind: "duel",
    title: "eric vs bob",
    week_start: "2026-09-28",
    target_sessions: 5,
    status: "active",
    members: members.map(([userId, progress]) => ({
      user_id: userId,
      username: `user-${userId}`,
      progress_sessions: progress,
    })),
  };
}

describe("duelParticipants", () => {
  it("splits the current user from the opponent", () => {
    const { you, opponent } = duelParticipants(
      challengeWith([
        [1, 2],
        [2, 3],
      ]),
      1,
    );
    expect(you?.user_id).toBe(1);
    expect(opponent?.user_id).toBe(2);
  });

  it("picks the strongest other member in group challenges", () => {
    const { opponent } = duelParticipants(
      challengeWith([
        [1, 4],
        [2, 1],
        [3, 5],
      ]),
      1,
    );
    expect(opponent?.user_id).toBe(3);
  });

  it("has no opponent while an invite is still pending", () => {
    const { you, opponent } = duelParticipants(challengeWith([[1, 0]]), 1);
    expect(you?.user_id).toBe(1);
    expect(opponent).toBeNull();
  });
});
