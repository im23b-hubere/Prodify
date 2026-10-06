import { useEffect, useState } from "react";

import type { SkillFocusId } from "../../../constants/skills";
import { loadSeenUnlockedSkills, saveSeenUnlockedSkills } from "../skillTreeSeen";

const NOTHING_NEW: ReadonlySet<SkillFocusId> = new Set();

export type NewlyUnlockedSkills = {
  ids: ReadonlySet<SkillFocusId>;
  /** False until the last-seen set has been read, so the count does not flash then rewind. */
  hasResolved: boolean;
};

/**
 * Focuses unlocked since the tree was last opened. They are marked as seen right away, so
 * each unlock is celebrated exactly once.
 */
export function useNewlyUnlockedSkills(
  userId: number | null | undefined,
  unlockedIds: SkillFocusId[] | null,
): NewlyUnlockedSkills {
  const [newlyUnlocked, setNewlyUnlocked] = useState<NewlyUnlockedSkills>({
    ids: NOTHING_NEW,
    hasResolved: false,
  });
  const unlockedKey = unlockedIds?.join(",") ?? null;

  useEffect(() => {
    if (userId == null || unlockedKey === null) {
      setNewlyUnlocked({ ids: NOTHING_NEW, hasResolved: false });
      return;
    }
    const ids = unlockedKey ? (unlockedKey.split(",") as SkillFocusId[]) : [];
    let isCurrent = true;
    loadSeenUnlockedSkills(userId).then((seen) => {
      if (!isCurrent) return;
      const fresh = ids.filter((id) => !seen.has(id));
      setNewlyUnlocked({
        ids: fresh.length > 0 ? new Set(fresh) : NOTHING_NEW,
        hasResolved: true,
      });
      void saveSeenUnlockedSkills(userId, ids);
    });
    return () => {
      isCurrent = false;
    };
  }, [unlockedKey, userId]);

  return newlyUnlocked;
}
