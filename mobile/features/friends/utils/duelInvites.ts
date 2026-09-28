import type { SocialChallengeDto } from "../../../types/friends";

export function isIncomingDuelInvite(challenge: SocialChallengeDto, userId: number | undefined) {
  return challenge.status === "pending" && userId != null && challenge.invitee_user_id === userId;
}

export function isOutgoingDuelInvite(challenge: SocialChallengeDto, userId: number | undefined) {
  return challenge.status === "pending" && userId != null && challenge.owner_id === userId;
}

export function duelInviteSenderName(challenge: SocialChallengeDto) {
  return challenge.members.find((member) => member.user_id === challenge.owner_id)?.username ?? null;
}
