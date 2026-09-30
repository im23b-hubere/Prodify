import type { DuelRecordDto, SocialChallengeDto } from "../../../types/friends";
import { challengeDaysLeft } from "../../friends/utils/friendsScreenFormat";
import { duelParticipants } from "../duelParticipants";

const HISTORY_LIMIT = 5;
const HOUR_MS = 60 * 60 * 1000;

export type DuelBoard = {
  /** The active duel closest to its end, shown as the big arena card. */
  arena: SocialChallengeDto | null;
  live: SocialChallengeDto[];
  /** Invites this user sent that the friend has not answered yet. */
  waiting: SocialChallengeDto[];
  history: SocialChallengeDto[];
};

/** Groups challenges into board sections; incoming invites are handled above the tabs. */
export function buildDuelBoard(
  challenges: SocialChallengeDto[],
  userId: number | undefined,
): DuelBoard {
  const active = challenges
    .filter((challenge) => challenge.status === "active")
    .sort((left, right) => duelDaysLeft(left) - duelDaysLeft(right));
  return {
    arena: active[0] ?? null,
    live: active.slice(1),
    waiting: challenges.filter(
      (challenge) =>
        challenge.status === "pending" && userId != null && challenge.owner_id === userId,
    ),
    history: challenges
      .filter((challenge) => challenge.status === "completed")
      .slice(0, HISTORY_LIMIT),
  };
}

export function isDuelBoardEmpty(board: DuelBoard) {
  return (
    board.arena == null &&
    board.live.length === 0 &&
    board.waiting.length === 0 &&
    board.history.length === 0
  );
}

export function duelDaysLeft(challenge: SocialChallengeDto) {
  return (
    challenge.days_remaining ??
    challengeDaysLeft(challenge.week_start, challenge.duration_days) ??
    challenge.duration_days ??
    7
  );
}

export type DuelStanding =
  | { kind: "fresh" }
  | { kind: "tied" }
  | { kind: "leading"; gap: number }
  | { kind: "behind"; gap: number };

export function duelStanding(yourScore: number, opponentScore: number): DuelStanding {
  if (yourScore === 0 && opponentScore === 0) return { kind: "fresh" };
  if (yourScore === opponentScore) return { kind: "tied" };
  return yourScore > opponentScore
    ? { kind: "leading", gap: yourScore - opponentScore }
    : { kind: "behind", gap: opponentScore - yourScore };
}

export type DuelOutcome =
  | { kind: "won" }
  | { kind: "tie" }
  | { kind: "lost"; winnerName: string | null };

export function duelOutcome(
  challenge: SocialChallengeDto,
  userId: number | undefined,
): DuelOutcome {
  if (challenge.is_tie) return { kind: "tie" };
  if (challenge.winner_user_id != null && challenge.winner_user_id === userId)
    return { kind: "won" };
  const winner = challenge.members.find((member) => member.user_id === challenge.winner_user_id);
  return { kind: "lost", winnerName: winner?.username ?? null };
}

export function duelRecordsByFriend(records: DuelRecordDto[]): Map<number, DuelRecordDto> {
  return new Map(records.map((record) => [record.friend_user_id, record]));
}

export function hasDuelHistory(record: DuelRecordDto | undefined): record is DuelRecordDto {
  return record != null && record.wins + record.losses + record.ties > 0;
}

export type RematchRequest = {
  friendId: number;
  targetSessions: number;
  durationDays: number;
};

export function rematchRequest(
  challenge: SocialChallengeDto,
  userId: number | undefined,
): RematchRequest | null {
  const { opponent } = duelParticipants(challenge, userId);
  if (opponent == null) return null;
  return {
    friendId: opponent.user_id,
    targetSessions: challenge.target_sessions,
    durationDays: challenge.duration_days ?? 7,
  };
}

/**
 * History rows that get a rematch button: only the latest finished duel per opponent,
 * and only while a new invite to that friend is possible.
 */
export function rematchableDuelIds(
  history: SocialChallengeDto[],
  userId: number | undefined,
  canChallenge: (friendId: number) => boolean,
): Set<number> {
  const seenOpponents = new Set<number>();
  const rematchable = new Set<number>();
  for (const challenge of history) {
    const request = rematchRequest(challenge, userId);
    if (request == null || seenOpponents.has(request.friendId)) continue;
    seenOpponents.add(request.friendId);
    if (canChallenge(request.friendId)) rematchable.add(challenge.id);
  }
  return rematchable;
}

/** Whole hours until the invite expires (rounded up), or `null` when the expiry is unknown. */
export function inviteHoursLeft(expiresAt: string | null | undefined, now: number): number | null {
  if (!expiresAt) return null;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return null;
  return Math.max(0, Math.ceil((expiresAtMs - now) / HOUR_MS));
}
