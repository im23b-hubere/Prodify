import { useState } from "react";

import type { SessionType } from "../../../constants/sessionTypes";
import { branchOfFocus, type SkillBranch, type SkillFocusId } from "../../../constants/skills";
import {
  browsesAreas,
  focusesAllowedForSessionType,
  focusesInBranch,
  isFocusSelectionFull,
  limitsToOneArea,
  toggleFocus,
} from "../skillFocusSelection";

/**
 * Optional skill focuses planned at session start. Picks that do not fit the current session
 * type or the browsed learning area stay stored (switching back restores them) but are never
 * exposed, so browsing is non-destructive. The next toggle commits the visible selection.
 * Production sessions browse areas too, but their picks may come from several areas.
 */
export function useSkillFocusFields(selectedType: SessionType | null) {
  const [pickedFocusIds, setPickedFocusIds] = useState<SkillFocusId[]>([]);
  const [browsedPracticeBranch, setBrowsedPracticeBranch] = useState<SkillBranch | null>(null);

  const isOneAreaAtATime = limitsToOneArea(selectedType);
  const focusIdsForType = selectedType
    ? focusesAllowedForSessionType(pickedFocusIds, selectedType)
    : [];
  const firstFocus = focusIdsForType[0];
  const practiceBranch = browsedPracticeBranch ?? (firstFocus ? branchOfFocus(firstFocus) : null);
  const focusIds = isOneAreaAtATime
    ? focusesInArea(focusIdsForType, practiceBranch)
    : focusIdsForType;

  /** Learning sessions pick within one area, so a suggestion competes with that area's picks. */
  const selectionAround = (id: SkillFocusId) =>
    isOneAreaAtATime ? focusesInBranch(focusIdsForType, branchOfFocus(id)) : focusIds;

  const applySuggestion = (id: SkillFocusId) => {
    const selection = selectionAround(id);
    const opensOtherArea = isOneAreaAtATime && branchOfFocus(id) !== practiceBranch;
    if (browsesAreas(selectedType)) setBrowsedPracticeBranch(branchOfFocus(id));
    if (opensOtherArea && selection.includes(id)) return;
    setPickedFocusIds(toggleFocus(selection, id));
  };

  const canApplySuggestion = (id: SkillFocusId) => {
    const selection = selectionAround(id);
    return selection.includes(id) || !isFocusSelectionFull(selection);
  };

  return {
    focusIds,
    isFocusSelectionFull: isFocusSelectionFull(focusIds),
    toggleFocus: (id: SkillFocusId) => setPickedFocusIds(toggleFocus(focusIds, id)),
    applySuggestion,
    canApplySuggestion,
    practiceBranch,
    selectPracticeBranch: setBrowsedPracticeBranch,
  };
}

function focusesInArea(
  focusIds: SkillFocusId[],
  practiceBranch: SkillBranch | null,
): SkillFocusId[] {
  return practiceBranch ? focusesInBranch(focusIds, practiceBranch) : [];
}

export type SkillFocusFields = ReturnType<typeof useSkillFocusFields>;
