import type { SocialChallengeDto } from "../../types/friends";

/** The user started or plays in this challenge; friends' challenges they only see do not count. */
export function isChallengeParticipant(challenge: SocialChallengeDto, userId: number | undefined) {
  if (userId == null) return false;
  return (
    challenge.owner_id === userId || challenge.members.some((member) => member.user_id === userId)
  );
}

/** A friend's running group challenge this user could still join. */
export function isJoinableFriendChallenge(challenge: SocialChallengeDto, userId: number | undefined) {
  return (
    challenge.status === "active" &&
    challenge.challenge_kind !== "duel" &&
    !isChallengeParticipant(challenge, userId)
  );
}
