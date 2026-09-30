import { useEffect, useState } from "react";

import type { SkillFocusId } from "../../../constants/skills";
import { loadSeenUnlockedSkills, saveSeenUnlockedSkills } from "../skillTreeSeen";

const NOTHING_NEW: ReadonlySet<SkillFocusId> = new Set();

/**
 * Focuses unlocked since the tree was last opened. They are marked as seen right away, so
 * each unlock is celebrated exactly once.
 */
export function useNewlyUnlockedSkills(
  userId: number | null | undefined,
  unlockedIds: SkillFocusId[] | null,
): ReadonlySet<SkillFocusId> {
  const [newlyUnlocked, setNewlyUnlocked] = useState(NOTHING_NEW);
  const unlockedKey = unlockedIds?.join(",") ?? null;

  useEffect(() => {
    if (userId == null || unlockedKey === null) return;
    const ids = unlockedKey ? (unlockedKey.split(",") as SkillFocusId[]) : [];
    let isCurrent = true;
    loadSeenUnlockedSkills(userId).then((seen) => {
      if (!isCurrent) return;
      const fresh = ids.filter((id) => !seen.has(id));
      if (fresh.length > 0) setNewlyUnlocked(new Set(fresh));
      void saveSeenUnlockedSkills(userId, ids);
    });
    return () => {
      isCurrent = false;
    };
  }, [unlockedKey, userId]);

  return newlyUnlocked;
}
