import { profilePictureUrl } from "../profile/friendProfilePresentation";
import type { SocialChallengeDto } from "../../types/friends";
import type { DuelClashPayload } from "./duelClashStore";

/** An invite-based duel the owner has not celebrated yet: accepted and still running. */
export function isAcceptedOwnedDuel(challenge: SocialChallengeDto, userId: number) {
  return (
    challenge.owner_id === userId &&
    challenge.challenge_kind === "duel" &&
    challenge.status === "active" &&
    challenge.invitee_user_id != null
  );
}

export function duelClashPayload(
  challenge: SocialChallengeDto,
  userId: number,
  fallbackYouName: string,
): DuelClashPayload | null {
  const you = challenge.members.find((member) => member.user_id === userId);
  const opponent = challenge.members.find((member) => member.user_id !== userId);
  if (!opponent) return null;
  return {
    challengeId: challenge.id,
    you: {
      name: you?.username ?? fallbackYouName,
      photoUri: profilePictureUrl(you?.profile_picture_url),
    },
    opponent: {
      name: opponent.username,
      photoUri: profilePictureUrl(opponent.profile_picture_url),
    },
  };
}
