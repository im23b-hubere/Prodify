import type { FriendLeaderboardEntryDto } from "../../../types/friends";

export const RANKING_PREVIEW_SIZE = 5;

export type RankingChase =
  | { kind: "fresh" }
  | { kind: "leading"; gap: number }
  | { kind: "tied"; name: string }
  | { kind: "behind"; gap: number; name: string };

export type YourStanding = {
  /** 1-based position in the ranking order. */
  position: number;
  total: number;
  sessions: number;
  streakDays: number;
  chase: RankingChase;
};

/** Where the user stands and who is right next to them; `null` when they are not ranked. */
export function yourStanding(
  entries: FriendLeaderboardEntryDto[],
  userId: number | undefined,
): YourStanding | null {
  const index = entries.findIndex((entry) => entry.user_id === userId);
  if (index < 0) return null;
  const you = entries[index];
  return {
    position: index + 1,
    total: entries.length,
    sessions: you.sessions_in_period,
    streakDays: you.current_streak_days,
    chase: chaseFor(entries, index),
  };
}

function chaseFor(entries: FriendLeaderboardEntryDto[], index: number): RankingChase {
  const you = entries[index];
  if (index > 0) {
    const ahead = entries[index - 1];
    const gap = ahead.sessions_in_period - you.sessions_in_period;
    return gap > 0
      ? { kind: "behind", gap, name: ahead.username }
      : { kind: "tied", name: ahead.username };
  }
  const runnerUp = entries[1];
  if (you.sessions_in_period === 0) return { kind: "fresh" };
  if (!runnerUp) return { kind: "leading", gap: you.sessions_in_period };
  const lead = you.sessions_in_period - runnerUp.sessions_in_period;
  return lead > 0 ? { kind: "leading", gap: lead } : { kind: "tied", name: runnerUp.username };
}

export type RankingRow = { entry: FriendLeaderboardEntryDto; position: number };

/**
 * The collapsed ranking shows the top entries and always keeps the user visible;
 * `hiddenCount` is how many rows expanding would add.
 */
export function visibleRanking(
  entries: FriendLeaderboardEntryDto[],
  userId: number | undefined,
  expanded: boolean,
): { rows: RankingRow[]; hiddenCount: number } {
  const all = entries.map((entry, index) => ({ entry, position: index + 1 }));
  if (expanded || all.length <= RANKING_PREVIEW_SIZE) return { rows: all, hiddenCount: 0 };
  const top = all.slice(0, RANKING_PREVIEW_SIZE);
  const you = all.find((row) => row.entry.user_id === userId);
  const rows = you && you.position > RANKING_PREVIEW_SIZE ? [...top, you] : top;
  return { rows, hiddenCount: all.length - rows.length };
}
