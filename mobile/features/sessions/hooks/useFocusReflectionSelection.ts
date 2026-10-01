import { useState } from "react";

import type { SessionType } from "../../../constants/sessionTypes";
import {
  branchOfFocus,
  skillBranchesForSessionType,
  type AreaWeight,
  type SkillBranch,
  type SkillFocusId,
} from "../../../constants/skills";
import { reflectedAreas, setAreaWeight, toggleArea, withExplicitAreaWeights } from "../areaWeights";
import {
  fitReflectionToSessionType,
  restrictToBranches,
  toggleFullPass,
  toggleMainFocus,
  toggleTouchedFocus,
  type FocusReflection,
} from "../skillFocusReflection";

/**
 * Tile selection for a session's focus reflection. Focuses outside the session type (or the
 * browsed learning area) stay stored but are never exposed, so browsing is non-destructive;
 * the next change commits the visible selection. Production sessions show every area the
 * user picked. Re-seeds whenever a new `seed` object arrives.
 */
export function useFocusReflectionSelection(
  sessionType: SessionType,
  seed: FocusReflection,
  onCommit?: (next: FocusReflection) => void,
) {
  const [pickedReflection, setPickedReflection] = useState(seed);
  const [browsedPracticeBranch, setBrowsedPracticeBranch] = useState<SkillBranch | null>(null);
  const [seededFrom, setSeededFrom] = useState(seed);
  if (seed !== seededFrom) {
    setSeededFrom(seed);
    setPickedReflection(seed);
    setBrowsedPracticeBranch(null);
  }

  const isLearning = sessionType === "learning";
  const isProduction = sessionType === "production";
  const committedReflection = fitReflectionToSessionType(pickedReflection, sessionType);
  const firstFocus = committedReflection.focusIds[0];
  const practiceBranch = isLearning
    ? (browsedPracticeBranch ?? (firstFocus ? branchOfFocus(firstFocus) : null))
    : null;
  const visibleBranches = visibleBranchesFor(sessionType, committedReflection, practiceBranch);
  const reflection = restrictToBranches(committedReflection, visibleBranches);

  const commit = (change: (current: FocusReflection) => FocusReflection) => {
    const next = change(isProduction ? withExplicitAreaWeights(reflection) : reflection);
    setPickedReflection(next);
    onCommit?.(next);
  };

  return {
    /** What the tiles show: the committed selection within the visible areas. */
    reflection,
    /** What a save should persist; browsing learning areas alone never changes it. */
    committedReflection,
    isLearning,
    isProduction,
    practiceBranch,
    selectPracticeBranch: setBrowsedPracticeBranch,
    visibleBranches,
    toggleArea: (branch: SkillBranch) => commit((current) => toggleArea(current, branch)),
    setAreaWeight: (branch: SkillBranch, weight: AreaWeight) =>
      commit((current) => setAreaWeight(current, branch, weight)),
    toggleFocus: (id: SkillFocusId) => commit((current) => toggleTouchedFocus(current, id)),
    toggleMainFocus: (id: SkillFocusId) => commit((current) => toggleMainFocus(current, id)),
    toggleFullPass: (branch: SkillBranch) => commit((current) => toggleFullPass(current, branch)),
  };
}

function visibleBranchesFor(
  sessionType: SessionType,
  reflection: FocusReflection,
  practiceBranch: SkillBranch | null,
): readonly SkillBranch[] {
  if (sessionType === "production") return reflectedAreas(reflection);
  if (sessionType === "learning") return practiceBranch ? [practiceBranch] : [];
  return skillBranchesForSessionType(sessionType);
}

export type FocusReflectionSelection = ReturnType<typeof useFocusReflectionSelection>;
