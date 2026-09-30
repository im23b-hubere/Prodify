import {
  RANKING_PREVIEW_SIZE,
  visibleRanking,
  yourStanding,
} from "../../../features/friends/ranking/friendsRanking";
import type { FriendLeaderboardEntryDto } from "../../../types/friends";

const YOU = 1;

function entry(
  userId: number,
  sessions: number,
  username = `user${userId}`,
): FriendLeaderboardEntryDto {
  return {
    rank: 0,
    user_id: userId,
    username,
    current_streak_days: 0,
    sessions_in_period: sessions,
  };
}

describe("yourStanding", () => {
  it("returns null when you are not in the ranking", () => {
    expect(yourStanding([entry(2, 3)], YOU)).toBeNull();
  });

  it("chases the friend directly ahead of you", () => {
    const standing = yourStanding([entry(2, 6), entry(3, 4, "bob"), entry(YOU, 1)], YOU);
    expect(standing).toMatchObject({ position: 3, total: 3, sessions: 1 });
    expect(standing?.chase).toEqual({ kind: "behind", gap: 3, name: "bob" });
  });

  it("is level when the friend ahead has the same sessions", () => {
    const standing = yourStanding([entry(2, 2, "bob"), entry(YOU, 2)], YOU);
    expect(standing?.chase).toEqual({ kind: "tied", name: "bob" });
  });

  it("leads by the gap to the runner-up", () => {
    const standing = yourStanding([entry(YOU, 5), entry(2, 3)], YOU);
    expect(standing?.chase).toEqual({ kind: "leading", gap: 2 });
  });

  it("is level with the runner-up when first place is shared", () => {
    const standing = yourStanding([entry(YOU, 3), entry(2, 3, "bob")], YOU);
    expect(standing?.chase).toEqual({ kind: "tied", name: "bob" });
  });

  it("invites a fresh start when everyone is at zero", () => {
    const standing = yourStanding([entry(YOU, 0), entry(2, 0)], YOU);
    expect(standing?.chase).toEqual({ kind: "fresh" });
  });
});

describe("visibleRanking", () => {
  const crowd = Array.from({ length: 7 }, (_, index) => entry(index + 10, 20 - index));

  it("shows everyone when the ranking is short", () => {
    const entries = crowd.slice(0, RANKING_PREVIEW_SIZE);
    expect(visibleRanking(entries, YOU, false)).toEqual({
      rows: entries.map((item, index) => ({ entry: item, position: index + 1 })),
      hiddenCount: 0,
    });
  });

  it("keeps you visible below the top five", () => {
    const entries = [...crowd, entry(YOU, 0)];
    const { rows, hiddenCount } = visibleRanking(entries, YOU, false);
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 8]);
    expect(hiddenCount).toBe(2);
  });

  it("does not duplicate you when you are already in the top five", () => {
    const entries = [entry(YOU, 30), ...crowd];
    const { rows, hiddenCount } = visibleRanking(entries, YOU, false);
    expect(rows).toHaveLength(RANKING_PREVIEW_SIZE);
    expect(hiddenCount).toBe(3);
  });

  it("shows every row when expanded", () => {
    const entries = [...crowd, entry(YOU, 0)];
    const { rows, hiddenCount } = visibleRanking(entries, YOU, true);
    expect(rows).toHaveLength(entries.length);
    expect(hiddenCount).toBe(0);
  });
});
