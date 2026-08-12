export type ChallengeEditDraft = {
  title: string;
  target_sessions: number;
  duration_days: number;
};

export function parseChallengeEditDraft(
  rawTitle: string,
  rawTarget: string,
  rawDuration: string,
): ChallengeEditDraft | null {
  const title = rawTitle.trim();
  const target = Number.parseInt(rawTarget, 10);
  const durationDays = Number.parseInt(rawDuration, 10);
  if (
    title.length < 3 ||
    !isPositiveInteger(target) ||
    durationDays < 3 ||
    !Number.isFinite(durationDays)
  ) {
    return null;
  }
  return { title, target_sessions: target, duration_days: durationDays };
}

function isPositiveInteger(value: number) {
  return Number.isFinite(value) && value >= 1;
}
