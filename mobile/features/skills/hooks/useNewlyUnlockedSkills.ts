import { useEffect, useState } from "react";

import type { SkillFocusId } from "../../../constants/skills";
import { loadSeenUnlockedSkills, saveSeenUnlockedSkills } from "../skillTreeSeen";

const NOTHING_NEW: ReadonlySet<SkillFocusId> = new Set();
const UNRESOLVED: NewlyUnlockedSkills = { ids: NOTHING_NEW, hasResolved: false };

export type NewlyUnlockedSkills = {
  ids: ReadonlySet<SkillFocusId>;
  /** False until the last-seen set has been read, so the count does not flash then rewind. */
  hasResolved: boolean;
};

type ResolvedLookup = { lookupKey: string; ids: ReadonlySet<SkillFocusId> };

/**
 * Focuses unlocked since the tree was last opened. They are marked as seen right away, so
 * each unlock is celebrated exactly once.
 */
export function useNewlyUnlockedSkills(
  userId: number | null | undefined,
  unlockedIds: SkillFocusId[] | null,
): NewlyUnlockedSkills {
  const [resolved, setResolved] = useState<ResolvedLookup | null>(null);
  const unlockedKey = unlockedIds?.join(",") ?? null;
  const lookupKey = userId == null || unlockedKey === null ? null : `${userId}:${unlockedKey}`;

  useEffect(() => {
    if (userId == null || unlockedKey === null || lookupKey === null) return;
    const ids = unlockedKey ? (unlockedKey.split(",") as SkillFocusId[]) : [];
    let isCurrent = true;
    loadSeenUnlockedSkills(userId).then((seen) => {
      if (!isCurrent) return;
      const fresh = ids.filter((id) => !seen.has(id));
      setResolved({ lookupKey, ids: fresh.length > 0 ? new Set(fresh) : NOTHING_NEW });
      void saveSeenUnlockedSkills(userId, ids);
    });
    return () => {
      isCurrent = false;
    };
  }, [lookupKey, unlockedKey, userId]);

  if (lookupKey === null || resolved?.lookupKey !== lookupKey) return UNRESOLVED;
  return { ids: resolved.ids, hasResolved: true };
}
