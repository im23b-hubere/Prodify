import type { SessionType } from "../../constants/sessionTypes";
import {
  branchOfFocus,
  focusesForBranch,
  skillBranchesForSessionType,
  type AreaWeight,
  type SkillBranch,
  type SkillFocusId,
} from "../../constants/skills";
import type { SessionDto } from "../../types/session";

export type AreaWeights = Partial<Record<SkillBranch, AreaWeight>>;

/**
 * What the user says they worked on after a session: everything touched, optionally one main
 * focus, and for production sessions how much went into each area.
 */
export type FocusReflection = {
  focusIds: SkillFocusId[];
  primaryFocusId: SkillFocusId | null;
  areaWeights: AreaWeights;
};

export function withoutOrphanedPrimary(
  reflection: FocusReflection,
  focusIds: SkillFocusId[],
): FocusReflection {
  const primary = reflection.primaryFocusId;
  return {
    ...reflection,
    focusIds,
    primaryFocusId: primary && focusIds.includes(primary) ? primary : null,
  };
}

export function restrictToBranches(
  reflection: FocusReflection,
  branches: readonly SkillBranch[],
): FocusReflection {
  const focusIds = reflection.focusIds.filter((id) => branches.includes(branchOfFocus(id)));
  const areaWeights = Object.fromEntries(
    Object.entries(reflection.areaWeights).filter(([branch]) =>
      branches.includes(branch as SkillBranch),
    ),
  ) as AreaWeights;
  return withoutOrphanedPrimary({ ...reflection, areaWeights }, focusIds);
}

/** Only production sessions weigh their areas; every type keeps just the focuses it allows. */
export function fitReflectionToSessionType(
  reflection: FocusReflection,
  sessionType: SessionType,
): FocusReflection {
  const restricted = restrictToBranches(reflection, skillBranchesForSessionType(sessionType));
  return sessionType === "production" ? restricted : { ...restricted, areaWeights: {} };
}

/** Everything stored for a session, whatever its current type allows. */
export function storedFocusReflection(session: SessionDto): FocusReflection {
  return {
    focusIds: session.skill_focus_ids ?? [],
    primaryFocusId: session.primary_skill_focus_id ?? null,
    areaWeights: Object.fromEntries(
      (session.area_weights ?? []).map(({ branch, weight }) => [branch, weight]),
    ),
  };
}

/** The stored reflection of a session, limited to what fits its session type. */
export function savedFocusReflection(
  session: SessionDto,
  sessionType: SessionType,
): FocusReflection {
  return fitReflectionToSessionType(storedFocusReflection(session), sessionType);
}

/** Removing a focus also removes its star; adding never changes the main focus. */
export function toggleTouchedFocus(reflection: FocusReflection, id: SkillFocusId): FocusReflection {
  const focusIds = reflection.focusIds.includes(id)
    ? reflection.focusIds.filter((current) => current !== id)
    : [...reflection.focusIds, id];
  return withoutOrphanedPrimary(reflection, focusIds);
}

/** Starring an untouched focus marks it as touched too; starring the main focus again unstars it. */
export function toggleMainFocus(reflection: FocusReflection, id: SkillFocusId): FocusReflection {
  if (reflection.primaryFocusId === id) return { ...reflection, primaryFocusId: null };
  const focusIds = reflection.focusIds.includes(id)
    ? reflection.focusIds
    : [...reflection.focusIds, id];
  return { ...reflection, focusIds, primaryFocusId: id };
}

export function isFullPass(focusIds: readonly SkillFocusId[], branch: SkillBranch): boolean {
  return focusesForBranch(branch).every(({ id }) => focusIds.includes(id));
}

/** Selects every focus of the branch, or clears the branch when it is already complete. */
export function toggleFullPass(reflection: FocusReflection, branch: SkillBranch): FocusReflection {
  if (isFullPass(reflection.focusIds, branch)) {
    const focusIds = reflection.focusIds.filter((id) => branchOfFocus(id) !== branch);
    return withoutOrphanedPrimary(reflection, focusIds);
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
    a.focusIds.every((id) => b.focusIds.includes(id)) &&
    hasSameAreaWeights(a.areaWeights, b.areaWeights)
  );
}

function hasSameAreaWeights(a: AreaWeights, b: AreaWeights): boolean {
  const branches = Object.keys(a) as SkillBranch[];
  return (
    branches.length === Object.keys(b).length && branches.every((branch) => a[branch] === b[branch])
  );
}
