import type { SocialChallengeDto, SocialChallengeMemberDto } from "../../types/friends";

export type DuelParticipants = {
  you: SocialChallengeMemberDto | null;
  /** The strongest other member, so group challenges show the person to beat. */
  opponent: SocialChallengeMemberDto | null;
};

export function duelParticipants(
  challenge: SocialChallengeDto,
  currentUserId: number | undefined,
): DuelParticipants {
  const you = challenge.members.find((member) => member.user_id === currentUserId) ?? null;
  const opponent =
    challenge.members
      .filter((member) => member.user_id !== currentUserId)
      .sort((left, right) => right.progress_sessions - left.progress_sessions)[0] ?? null;
  return { you, opponent };
}
