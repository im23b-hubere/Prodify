import {
  buildDuelBoard,
  duelOutcome,
  duelRecordsByFriend,
  duelStanding,
  hasDuelHistory,
  inviteHoursLeft,
  isDuelBoardEmpty,
  rematchableDuelIds,
  rematchRequest,
} from "../../../features/challenges/board/duelBoard";
import type { SocialChallengeDto } from "../../../types/friends";

function duel(overrides: Partial<SocialChallengeDto>): SocialChallengeDto {
  return {
    id: 1,
    owner_id: 1,
    challenge_kind: "duel",
    title: "eric vs bob",
    week_start: "2026-09-28",
    target_sessions: 5,
    status: "active",
    members: [
      { user_id: 1, username: "eric", progress_sessions: 0 },
      { user_id: 2, username: "bob", progress_sessions: 0 },
    ],
    ...overrides,
  };
}

describe("buildDuelBoard", () => {
  it("puts the active duel closest to its end into the arena", () => {
    const board = buildDuelBoard(
      [duel({ id: 1, days_remaining: 6 }), duel({ id: 2, days_remaining: 2 })],
      1,
    );
    expect(board.arena?.id).toBe(2);
    expect(board.live.map((challenge) => challenge.id)).toEqual([1]);
  });

  it("lists only invites this user sent as waiting", () => {
    const board = buildDuelBoard(
      [
        duel({ id: 3, status: "pending", owner_id: 1, invitee_user_id: 2 }),
        duel({ id: 4, status: "pending", owner_id: 2, invitee_user_id: 1 }),
      ],
      1,
    );
    expect(board.waiting.map((challenge) => challenge.id)).toEqual([3]);
  });

  it("keeps the five most recent completed duels as history", () => {
    const completed = [1, 2, 3, 4, 5, 6].map((id) => duel({ id, status: "completed" }));
    expect(buildDuelBoard(completed, 1).history).toHaveLength(5);
  });

  it("is empty without any duels", () => {
    expect(isDuelBoardEmpty(buildDuelBoard([], 1))).toBe(true);
  });
});

describe("duelStanding", () => {
  it("describes who is ahead and by how much", () => {
    expect(duelStanding(0, 0)).toEqual({ kind: "fresh" });
    expect(duelStanding(2, 2)).toEqual({ kind: "tied" });
    expect(duelStanding(4, 1)).toEqual({ kind: "leading", gap: 3 });
    expect(duelStanding(1, 3)).toEqual({ kind: "behind", gap: 2 });
  });
});

describe("duelOutcome", () => {
  it("names the winner when the user lost", () => {
    expect(duelOutcome(duel({ status: "completed", winner_user_id: 2 }), 1)).toEqual({
      kind: "lost",
      winnerName: "bob",
    });
    expect(duelOutcome(duel({ status: "completed", winner_user_id: 1 }), 1)).toEqual({
      kind: "won",
    });
    expect(duelOutcome(duel({ status: "completed", is_tie: true }), 1)).toEqual({ kind: "tie" });
  });
});

describe("rematchRequest", () => {
  it("replays the finished duel's goal against the same opponent", () => {
    expect(
      rematchRequest(duel({ status: "completed", target_sessions: 8, duration_days: 14 }), 1),
    ).toEqual({ friendId: 2, targetSessions: 8, durationDays: 14 });
  });

  it("gives up when the opponent is unknown", () => {
    expect(rematchRequest(duel({ members: [] }), 1)).toBeNull();
  });
});

describe("rematchableDuelIds", () => {
  const carol = { user_id: 3, username: "carol", progress_sessions: 0 };
  const history = [
    duel({ id: 10, status: "completed" }),
    duel({ id: 11, status: "completed" }),
    duel({ id: 12, status: "completed", members: [duel({}).members[0], carol] }),
  ];

  it("offers a rematch only on the latest duel per opponent", () => {
    expect([...rematchableDuelIds(history, 1, () => true)]).toEqual([10, 12]);
  });

  it("skips opponents that cannot be challenged right now", () => {
    expect([...rematchableDuelIds(history, 1, (friendId) => friendId === 3)]).toEqual([12]);
  });
});

describe("duel records", () => {
  it("looks records up by friend and ignores empty tallies", () => {
    const records = duelRecordsByFriend([
      { friend_user_id: 2, wins: 3, losses: 1, ties: 0 },
      { friend_user_id: 3, wins: 0, losses: 0, ties: 0 },
    ]);
    expect(hasDuelHistory(records.get(2))).toBe(true);
    expect(hasDuelHistory(records.get(3))).toBe(false);
    expect(hasDuelHistory(records.get(4))).toBe(false);
  });
});

describe("inviteHoursLeft", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");

  it("rounds the remaining time up to whole hours", () => {
    expect(inviteHoursLeft("2026-10-01T18:30:00Z", now)).toBe(31);
  });

  it("never goes below zero and ignores unknown expiries", () => {
    expect(inviteHoursLeft("2026-09-30T10:00:00Z", now)).toBe(0);
    expect(inviteHoursLeft(null, now)).toBeNull();
  });
});
