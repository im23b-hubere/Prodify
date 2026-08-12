import type { TFunction } from "i18next";

import {
  challengeLeader,
  challengeOutcome,
  challengeStatusLabel,
  memberProgressPercent,
  parseChallengeId,
  totalChallengeSessions,
} from "../../../features/challenges/challengeDetailPresentation";
import type { SocialChallengeDto } from "../../../types/friends";

const translate = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as TFunction;

function challenge(overrides: Partial<SocialChallengeDto> = {}): SocialChallengeDto {
  return {
    id: 4,
    owner_id: 1,
    challenge_kind: "duel",
    title: "Finish tracks",
    week_start: "2026-08-03",
    target_sessions: 5,
    duration_days: 7,
    status: "active",
    members: [
      { user_id: 1, username: "Ada", progress_sessions: 4 },
      { user_id: 2, username: "Lin", progress_sessions: 2 },
    ],
    ...overrides,
  };
}

describe("challenge detail presentation", () => {
  it("parses only positive challenge ids", () => {
    expect(parseChallengeId("12")).toBe(12);
    expect(parseChallengeId(["7", "8"])).toBe(7);
    expect(parseChallengeId("0")).toBeNull();
    expect(parseChallengeId("invalid")).toBeNull();
  });

  it("returns one leader, but no leader for a tie", () => {
    expect(challengeLeader(challenge())?.username).toBe("Ada");
    expect(
      challengeLeader(
        challenge({
          members: [
            { user_id: 1, username: "Ada", progress_sessions: 4 },
            { user_id: 2, username: "Lin", progress_sessions: 4 },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("aggregates sessions and clamps member progress", () => {
    expect(totalChallengeSessions(challenge())).toBe(6);
    expect(memberProgressPercent(3, 5)).toBe(60);
    expect(memberProgressPercent(8, 5)).toBe(100);
    expect(memberProgressPercent(-1, 0)).toBe(0);
  });

  it("describes completed challenge outcomes", () => {
    expect(challengeStatusLabel(challenge({ status: "completed", is_tie: true }), translate)).toBe(
      "challengeDetail.statusTie",
    );
    expect(
      challengeOutcome(challenge({ status: "completed", winner_user_id: 1 }), 1, translate),
    ).toBe("friendsScreen.challengeYouWon");
    expect(
      challengeOutcome(challenge({ status: "completed", winner_user_id: 2 }), 1, translate),
    ).toContain('"winner":"Lin"');
  });
});
