import type { SocialChallengeDto } from "../../types/friends";

export type ChallengeEditDraft = {
  title: string;
  target_sessions?: number;
  duration_days?: number;
};

/** Both players agreed to a duel's target and length, so only its title may change afterwards. */
export function challengeTermsLocked(challenge: Pick<SocialChallengeDto, "challenge_kind">) {
  return challenge.challenge_kind === "duel";
}

export function parseChallengeEditDraft(
  rawTitle: string,
  rawTarget: string,
  rawDuration: string,
  { termsLocked = false }: { termsLocked?: boolean } = {},
): ChallengeEditDraft | null {
  const title = rawTitle.trim();
  if (title.length < 3) return null;
  if (termsLocked) return { title };

  const target = Number.parseInt(rawTarget, 10);
  const durationDays = Number.parseInt(rawDuration, 10);
  if (!isPositiveInteger(target) || durationDays < 3 || !Number.isFinite(durationDays)) {
    return null;
  }
  return { title, target_sessions: target, duration_days: durationDays };
}

function isPositiveInteger(value: number) {
  return Number.isFinite(value) && value >= 1;
}
