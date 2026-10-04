import type { SocialChallengeDto } from "../../../types/friends";

export function isIncomingDuelInvite(challenge: SocialChallengeDto, userId: number | undefined) {
  return challenge.status === "pending" && userId != null && challenge.invitee_user_id === userId;
}

export function isOutgoingDuelInvite(challenge: SocialChallengeDto, userId: number | undefined) {
  return challenge.status === "pending" && userId != null && challenge.owner_id === userId;
}
