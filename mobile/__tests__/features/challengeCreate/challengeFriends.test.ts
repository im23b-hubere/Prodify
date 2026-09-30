import {
  challengeFriendOptions,
  matchesFriendSearch,
} from "../../../features/challengeCreate/challengeFriends";
import type { FriendLeaderboardEntryDto, SocialChallengeDto } from "../../../types/friends";

function entry(userId: number, username: string): FriendLeaderboardEntryDto {
  return { rank: userId, user_id: userId, username, current_streak_days: 0, sessions_in_period: 0 };
}

function duelWith(id: number, friendId: number): SocialChallengeDto {
  return {
    id,
    owner_id: 1,
    invitee_user_id: friendId,
    title: "duel",
    challenge_kind: "duel",
    week_start: "2026-09-28",
    target_sessions: 5,
    status: "completed",
    members: [],
  };
}

describe("challengeFriendOptions", () => {
  const entries = [entry(1, "me"), entry(2, "zoe"), entry(3, "adam"), entry(4, "mia")];

  it("leaves you out of your own rival list", () => {
    const options = challengeFriendOptions(entries, [], 1);
    expect(options.map((option) => option.userId)).not.toContain(1);
  });

  it("puts the most recent rivals first and sorts the rest by name", () => {
    const options = challengeFriendOptions(entries, [duelWith(5, 2), duelWith(8, 4)], 1);
    expect(options.map((option) => option.username)).toEqual(["mia", "zoe", "adam"]);
  });
});

describe("matchesFriendSearch", () => {
  const friend = { userId: 2, username: "BeatSmith", photoUri: null };

  it("matches case-insensitively and treats a blank query as a match", () => {
    expect(matchesFriendSearch(friend, " beat ")).toBe(true);
    expect(matchesFriendSearch(friend, "")).toBe(true);
    expect(matchesFriendSearch(friend, "zoe")).toBe(false);
  });
});
