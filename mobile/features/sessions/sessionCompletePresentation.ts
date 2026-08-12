import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";

const SESSION_XP_MINUTES_FLOOR = 5;
const BASE_SESSION_XP = 5;
const SESSION_XP_PER_MINUTE_AFTER_FLOOR = 0.5;
const SESSION_XP_MAX = 85;

export const MINIMUM_COUNTED_SESSION_MINUTES = SESSION_XP_MINUTES_FLOOR;

export function shortenSessionLabel(value: string, maxLength = 14): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxLength - 1))}…`;
}

export function sessionHighlightKey(feedback: SessionFeedbackComputed): string {
  const statusChanged =
    feedback.previousStatus != null && feedback.previousStatus !== feedback.newStatus;
  if (
    feedback.remainingSessionsToGoal === 0 ||
    statusChanged ||
    feedback.newStatus === "off_track"
  ) {
    return feedback.statusMessageKey;
  }
  return feedback.emotionalMessageKey;
}

export function estimateSessionXpGain(durationSeconds: number): number {
  const minutes = Math.max(0, Math.floor(durationSeconds / 60));
  if (minutes < SESSION_XP_MINUTES_FLOOR) return 0;

  const scaledMinutes = minutes - SESSION_XP_MINUTES_FLOOR;
  let xp = BASE_SESSION_XP + Math.floor(scaledMinutes * SESSION_XP_PER_MINUTE_AFTER_FLOOR);
  if (minutes >= 25) xp += 3;
  if (minutes >= 45) xp += 5;
  if (minutes >= 75) xp += 7;
  return Math.min(SESSION_XP_MAX, xp);
}

export const MINIMUM_COUNTED_SESSION_SECONDS = SESSION_XP_MINUTES_FLOOR * 60;
