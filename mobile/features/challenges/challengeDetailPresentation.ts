import type { TFunction } from "i18next";

import { challengeDaysLeft } from "../friends/utils/friendsScreenFormat";
import type { SocialChallengeDto } from "../../types/friends";

export function parseChallengeId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function challengeStatusLabel(challenge: SocialChallengeDto, t: TFunction): string {
  if (challenge.status === "completed") {
    return t(challenge.is_tie ? "challengeDetail.statusTie" : "challengeDetail.statusCompleted");
  }
  if (challenge.status === "cancelled") return t("challengeDetail.statusCancelled");
  return t("challengeDetail.statusActive");
}

export function remainingChallengeDays(challenge: SocialChallengeDto | null): number {
  if (!challenge) return 0;
  return (
    challenge.days_remaining ??
    challengeDaysLeft(challenge.week_start, challenge.duration_days) ??
    challenge.duration_days ??
    7
  );
}

export function challengeLeader(challenge: SocialChallengeDto | null) {
  if (!challenge?.members.length) return null;
  const highestProgress = Math.max(...challenge.members.map((member) => member.progress_sessions));
  const leaders = challenge.members.filter(
    (member) => member.progress_sessions === highestProgress,
  );
  return leaders.length === 1 ? leaders[0] : null;
}

export function totalChallengeSessions(challenge: SocialChallengeDto | null): number {
  return challenge?.members.reduce((sum, member) => sum + member.progress_sessions, 0) ?? 0;
}

export function memberProgressPercent(progress: number, target: number): number {
  return Math.max(0, Math.min(100, Math.round((progress / Math.max(1, target)) * 100)));
}

export function challengeOutcome(
  challenge: SocialChallengeDto | null,
  currentUserId: number | undefined,
  t: TFunction,
): string | null {
  if (!challenge || challenge.status !== "completed") return null;
  if (challenge.is_tie) return t("friendsScreen.challengeEndedTie");
  if (challenge.winner_user_id === currentUserId) return t("friendsScreen.challengeYouWon");
  const winner =
    challenge.members.find((member) => member.user_id === challenge.winner_user_id)?.username ??
    t("friendsScreen.challengeSomeone");
  return t("friendsScreen.challengeEndedWinner", { winner });
}
