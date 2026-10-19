import type { FriendProgressionEntryDto } from "../../types/friends";

export type { FriendProgressionEntryDto, FriendsProgressionDto } from "../../types/friends";

export type FriendPathCluster = {
  level: number;
  /** Front-to-back stack drawn on the node (max 3). */
  visible: FriendProgressionEntryDto[];
  /** Count for the `+N` badge; 0 when every friend fits in the stack. */
  overflowCount: number;
  /** Full list for the cluster sheet. */
  all: FriendProgressionEntryDto[];
};

const CATALOG_MIN = 1;
const CATALOG_MAX = 20;
const DEFAULT_MAX_VISIBLE = 3;

export function clusterFriendsByLevel(
  friends: FriendProgressionEntryDto[],
  options?: { maxVisible?: number; excludeUserId?: number | null },
): FriendPathCluster[] {
  const maxVisible = options?.maxVisible ?? DEFAULT_MAX_VISIBLE;
  const excludeUserId = options?.excludeUserId ?? null;
  const byLevel = new Map<number, FriendProgressionEntryDto[]>();

  for (const friend of friends) {
    if (excludeUserId != null && friend.user_id === excludeUserId) continue;
    const level = Math.trunc(friend.level);
    if (level < CATALOG_MIN || level > CATALOG_MAX) continue;
    const bucket = byLevel.get(level);
    if (bucket) bucket.push(friend);
    else byLevel.set(level, [friend]);
  }

  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, all]) => {
      const visible = all.slice(0, maxVisible);
      const overflowCount = Math.max(0, all.length - maxVisible);
      return { level, visible, overflowCount, all };
    });
}
