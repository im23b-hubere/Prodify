import type { SessionType } from "../../constants/sessionTypes";
import {
  branchOfFocus,
  focusesForBranch,
  skillBranchesForSessionType,
  type SkillBranch,
  type SkillFocusId,
} from "../../constants/skills";
import type { SessionDto } from "../../types/session";

/** What the user says they worked on after a session: everything touched plus one main focus. */
export type FocusReflection = {
  focusIds: SkillFocusId[];
  primaryFocusId: SkillFocusId | null;
};

function withoutOrphanedPrimary(focusIds: SkillFocusId[], primary: SkillFocusId | null) {
  return { focusIds, primaryFocusId: primary && focusIds.includes(primary) ? primary : null };
}

export function restrictToBranches(
  reflection: FocusReflection,
  branches: readonly SkillBranch[],
): FocusReflection {
  const focusIds = reflection.focusIds.filter((id) => branches.includes(branchOfFocus(id)));
  return withoutOrphanedPrimary(focusIds, reflection.primaryFocusId);
}

/** The stored reflection of a session, limited to what fits its session type. */
export function savedFocusReflection(session: SessionDto, sessionType: SessionType): FocusReflection {
  return restrictToBranches(
    {
      focusIds: session.skill_focus_ids ?? [],
      primaryFocusId: session.primary_skill_focus_id ?? null,
    },
    skillBranchesForSessionType(sessionType),
  );
}

/** Removing a focus also removes its star; adding never changes the main focus. */
export function toggleTouchedFocus(reflection: FocusReflection, id: SkillFocusId): FocusReflection {
  const focusIds = reflection.focusIds.includes(id)
    ? reflection.focusIds.filter((current) => current !== id)
    : [...reflection.focusIds, id];
  return withoutOrphanedPrimary(focusIds, reflection.primaryFocusId);
}

/** Starring an untouched focus marks it as touched too; starring the main focus again unstars it. */
export function toggleMainFocus(reflection: FocusReflection, id: SkillFocusId): FocusReflection {
  if (reflection.primaryFocusId === id) return { ...reflection, primaryFocusId: null };
  const focusIds = reflection.focusIds.includes(id)
    ? reflection.focusIds
    : [...reflection.focusIds, id];
  return { focusIds, primaryFocusId: id };
}

export function isFullPass(focusIds: readonly SkillFocusId[], branch: SkillBranch): boolean {
  return focusesForBranch(branch).every(({ id }) => focusIds.includes(id));
}

/** Selects every focus of the branch, or clears the branch when it is already complete. */
export function toggleFullPass(reflection: FocusReflection, branch: SkillBranch): FocusReflection {
  if (isFullPass(reflection.focusIds, branch)) {
    const focusIds = reflection.focusIds.filter((id) => branchOfFocus(id) !== branch);
    return withoutOrphanedPrimary(focusIds, reflection.primaryFocusId);
  }
  const missing = focusesForBranch(branch)
    .map(({ id }) => id)
    .filter((id) => !reflection.focusIds.includes(id));
  return { ...reflection, focusIds: [...reflection.focusIds, ...missing] };
}

export function isSameReflection(a: FocusReflection, b: FocusReflection): boolean {
  return (
    a.primaryFocusId === b.primaryFocusId &&
    a.focusIds.length === b.focusIds.length &&
    a.focusIds.every((id) => b.focusIds.includes(id))
  );
}
