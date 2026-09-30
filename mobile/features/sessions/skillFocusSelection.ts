import type { SessionType } from "../../constants/sessionTypes";
import {
  MAX_PLANNED_FOCUSES_PER_SESSION,
  branchOfFocus,
  skillBranchesForSessionType,
  type SkillBranch,
  type SkillFocusId,
} from "../../constants/skills";

/** Focuses that are valid for the session type, in selection order. */
export function focusesAllowedForSessionType(
  focusIds: readonly SkillFocusId[],
  type: SessionType,
): SkillFocusId[] {
  const branches = skillBranchesForSessionType(type);
  return focusIds.filter((id) => branches.includes(branchOfFocus(id)));
}

export function isFocusSelectionFull(focusIds: readonly SkillFocusId[]): boolean {
  return focusIds.length >= MAX_PLANNED_FOCUSES_PER_SESSION;
}

/** Deselects a chosen focus; selects a new one only while there is room. */
export function toggleFocus(focusIds: readonly SkillFocusId[], id: SkillFocusId): SkillFocusId[] {
  if (focusIds.includes(id)) return focusIds.filter((current) => current !== id);
  if (isFocusSelectionFull(focusIds)) return [...focusIds];
  return [...focusIds, id];
}

export function focusesInBranch(
  focusIds: readonly SkillFocusId[],
  branch: SkillBranch,
): SkillFocusId[] {
  return focusIds.filter((id) => branchOfFocus(id) === branch);
}
