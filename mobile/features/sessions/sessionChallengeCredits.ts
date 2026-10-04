import type { SessionChallengeCreditDto, SessionCreditSkipReason } from "../../types/friends";
import { MINIMUM_COUNTED_SESSION_SECONDS } from "./sessionCompletePresentation";

export type ChallengeCreditLine = {
  counted: boolean;
  key: string;
  params?: Record<string, number>;
};

const SKIP_REASON_KEYS: Record<SessionCreditSkipReason, string> = {
  not_started: "sessionComplete.challengeSkipNotStarted",
  too_short: "sessionComplete.challengeSkipTooShort",
  before_start: "sessionComplete.challengeSkipBeforeStart",
  after_end: "sessionComplete.challengeSkipAfterEnd",
  already_finished: "sessionComplete.challengeSkipAlreadyFinished",
  session_deleted: "sessionComplete.challengeSkipDeleted",
};

/** One line per challenge telling the producer whether this session moved it, and why not. */
export function describeChallengeCredit(
  credit: SessionChallengeCreditDto,
  currentUserId: number | undefined,
): ChallengeCreditLine {
  if (!credit.credited) return describeSkip(credit.reason);
  if (credit.status !== "completed") {
    return {
      counted: true,
      key: "sessionComplete.challengeCreditCounted",
      params: { progress: credit.progress_sessions, target: credit.target_sessions },
    };
  }
  if (credit.is_tie) return { counted: true, key: "sessionComplete.challengeCreditTied" };
  return credit.winner_user_id === currentUserId
    ? { counted: true, key: "sessionComplete.challengeCreditWon" }
    : { counted: true, key: "sessionComplete.challengeCreditLost" };
}

function describeSkip(reason: SessionCreditSkipReason | null): ChallengeCreditLine {
  if (!reason) return { counted: false, key: "sessionComplete.challengeSkipUnknown" };
  return {
    counted: false,
    key: SKIP_REASON_KEYS[reason],
    params:
      reason === "too_short" ? { minutes: MINIMUM_COUNTED_SESSION_SECONDS / 60 } : undefined,
  };
}
