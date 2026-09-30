import type { FriendLeaderboardEntryDto, SocialChallengeDto } from "../../types/friends";
import { profilePictureUrl } from "../profile/friendProfilePresentation";

export type ChallengeFriendOption = {
  userId: number;
  username: string;
  photoUri: string | null;
};

/** Friends you can challenge, most recent rivals first, then alphabetical. */
export function challengeFriendOptions(
  entries: FriendLeaderboardEntryDto[],
  challenges: SocialChallengeDto[],
  userId: number | undefined,
): ChallengeFriendOption[] {
  const lastDuelIdByFriend = lastDuelIdByOpponent(challenges, userId);
  return entries
    .filter((entry) => entry.user_id !== userId)
    .map((entry) => ({
      userId: entry.user_id,
      username: entry.username,
      photoUri: profilePictureUrl(entry.profile_picture_url),
    }))
    .sort((a, b) => {
      const recency =
        (lastDuelIdByFriend.get(b.userId) ?? 0) - (lastDuelIdByFriend.get(a.userId) ?? 0);
      return recency !== 0 ? recency : a.username.localeCompare(b.username);
    });
}

function lastDuelIdByOpponent(challenges: SocialChallengeDto[], userId: number | undefined) {
  const lastIds = new Map<number, number>();
  if (userId == null) return lastIds;
  for (const challenge of challenges) {
    if (challenge.challenge_kind !== "duel") continue;
    const participantIds = new Set([
      challenge.owner_id,
      ...(challenge.invitee_user_id != null ? [challenge.invitee_user_id] : []),
      ...challenge.members.map((member) => member.user_id),
    ]);
    if (!participantIds.has(userId)) continue;
    for (const participantId of participantIds) {
      if (participantId === userId) continue;
      lastIds.set(participantId, Math.max(lastIds.get(participantId) ?? 0, challenge.id));
    }
  }
  return lastIds;
}

export function matchesFriendSearch(friend: ChallengeFriendOption, query: string) {
  const needle = query.trim().toLowerCase();
  return needle.length === 0 || friend.username.toLowerCase().includes(needle);
}
