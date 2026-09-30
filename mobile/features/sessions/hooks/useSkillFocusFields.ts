import { useState } from "react";

import type { SessionType } from "../../../constants/sessionTypes";
import { branchOfFocus, type SkillBranch, type SkillFocusId } from "../../../constants/skills";
import {
  focusesAllowedForSessionType,
  focusesInBranch,
  isFocusSelectionFull,
  toggleFocus,
} from "../skillFocusSelection";

/**
 * Optional skill focuses planned at session start. Picks that do not fit the current session
 * type or the browsed learning area stay stored (switching back restores them) but are never
 * exposed, so browsing is non-destructive. The next toggle commits the visible selection.
 */
export function useSkillFocusFields(selectedType: SessionType | null) {
  const [pickedFocusIds, setPickedFocusIds] = useState<SkillFocusId[]>([]);
  const [browsedPracticeBranch, setBrowsedPracticeBranch] = useState<SkillBranch | null>(null);

  const focusIdsForType = selectedType
    ? focusesAllowedForSessionType(pickedFocusIds, selectedType)
    : [];
  const firstFocus = focusIdsForType[0];
  const practiceBranch = browsedPracticeBranch ?? (firstFocus ? branchOfFocus(firstFocus) : null);
  const focusIds = exposedFocusIds(focusIdsForType, selectedType, practiceBranch);

  return {
    focusIds,
    isFocusSelectionFull: isFocusSelectionFull(focusIds),
    toggleFocus: (id: SkillFocusId) => setPickedFocusIds(toggleFocus(focusIds, id)),
    practiceBranch,
    selectPracticeBranch: setBrowsedPracticeBranch,
  };
}

function exposedFocusIds(
  focusIdsForType: SkillFocusId[],
  selectedType: SessionType | null,
  practiceBranch: SkillBranch | null,
): SkillFocusId[] {
  if (selectedType !== "learning") return focusIdsForType;
  return practiceBranch ? focusesInBranch(focusIdsForType, practiceBranch) : [];
}

export type SkillFocusFields = ReturnType<typeof useSkillFocusFields>;
