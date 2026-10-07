import type { SessionType } from "../../constants/sessionTypes";
import {
  DEFAULT_AREA_WEIGHT,
  branchOfFocus,
  focusesForBranch,
  skillBranchesForSessionType,
  type AreaWeight,
  type SkillBranch,
  type SkillFocusId,
} from "../../constants/skills";
import type { SessionDto } from "../../types/session";
import type { SkillTimeAllocation } from "./focusTime";

export type AreaWeights = Partial<Record<SkillBranch, AreaWeight>>;

/**
 * What the user says they worked on after a session: everything touched, optionally one main
 * focus, and for production sessions how much went into each area.
 */
export type FocusReflection = {
  focusIds: SkillFocusId[];
  primaryFocusId: SkillFocusId | null;
  areaWeights: AreaWeights;
  assignedSeconds?: SkillTimeAllocation;
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
    assignedSeconds: reflection.assignedSeconds
      ? assignedSecondsFor(reflection, focusIds)
      : reflection.assignedSeconds,
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
  const focusIds = session.skill_focus_ids ?? [];
  return {
    focusIds,
    primaryFocusId: session.primary_skill_focus_id ?? null,
    areaWeights: storedAreaWeights(focusIds, session.area_weights ?? []),
    assignedSeconds: storedAssignedSeconds(focusIds, session.focus_times ?? []),
  };
}

function storedAssignedSeconds(
  focusIds: SkillFocusId[],
  times: NonNullable<SessionDto["focus_times"]>,
): SkillTimeAllocation {
  const allowed = new Set(focusIds);
  const assigned: SkillTimeAllocation = {};
  for (const row of times) {
    if (!allowed.has(row.skill_id)) continue;
    assigned[row.skill_id] = row.assigned_seconds;
  }
  return assigned;
}

function assignedSecondsFor(
  reflection: FocusReflection,
  focusIds: SkillFocusId[],
): SkillTimeAllocation {
  const assigned: SkillTimeAllocation = {};
  for (const id of focusIds) {
    const seconds = reflection.assignedSeconds?.[id];
    if (seconds !== undefined) assigned[id] = seconds;
  }
  return assigned;
}

/** Areas reached only through a focus count as "some", as they do on the server. */
function storedAreaWeights(
  focusIds: SkillFocusId[],
  weights: NonNullable<SessionDto["area_weights"]>,
): AreaWeights {
  const focusAreas = focusIds.map((id) => [branchOfFocus(id), DEFAULT_AREA_WEIGHT] as const);
  const weighted = weights.map(({ branch, weight }) => [branch, weight] as const);
  return Object.fromEntries([...focusAreas, ...weighted]);
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
    hasSameAreaWeights(a.areaWeights, b.areaWeights) &&
    hasSameAssignedSeconds(a.assignedSeconds, b.assignedSeconds)
  );
}

function hasSameAssignedSeconds(
  a: SkillTimeAllocation | undefined,
  b: SkillTimeAllocation | undefined,
): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const ids = Object.keys(left);
  return (
    ids.length === Object.keys(right).length &&
    ids.every((id) => left[id as SkillFocusId] === right[id as SkillFocusId])
  );
}

function hasSameAreaWeights(a: AreaWeights, b: AreaWeights): boolean {
  const branches = Object.keys(a) as SkillBranch[];
  return (
    branches.length === Object.keys(b).length && branches.every((branch) => a[branch] === b[branch])
  );
}
