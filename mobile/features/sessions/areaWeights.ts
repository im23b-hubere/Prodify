import {
  DEFAULT_AREA_WEIGHT,
  SKILL_BRANCHES,
  branchOfFocus,
  type AreaWeight,
  type SkillBranch,
} from "../../constants/skills";
import { MINIMUM_COUNTED_SESSION_SECONDS } from "./sessionCompletePresentation";
import { withoutOrphanedPrimary, type FocusReflection } from "./skillFocusReflection";

const MAX_COUNTED_SESSION_SECONDS = 12 * 3600;

export type AreaTime = { branch: SkillBranch; seconds: number };

/** Areas the session went into: weighted ones plus those of touched focuses, in catalog order. */
export function reflectedAreas(reflection: FocusReflection): SkillBranch[] {
  const focusAreas = new Set(reflection.focusIds.map(branchOfFocus));
  return SKILL_BRANCHES.filter(
    (branch) => focusAreas.has(branch) || reflection.areaWeights[branch] !== undefined,
  );
}

/** Areas only reached through a focus count as "some" until the user weighs them. */
export function weightOfArea(reflection: FocusReflection, branch: SkillBranch): AreaWeight {
  return reflection.areaWeights[branch] ?? DEFAULT_AREA_WEIGHT;
}

/** Pins every reflected area to its current weight, so deselecting its last focus keeps it. */
export function withExplicitAreaWeights(reflection: FocusReflection): FocusReflection {
  const areaWeights = Object.fromEntries(
    reflectedAreas(reflection).map((branch) => [branch, weightOfArea(reflection, branch)]),
  );
  return { ...reflection, areaWeights };
}

export function toggleArea(reflection: FocusReflection, branch: SkillBranch): FocusReflection {
  if (!reflectedAreas(reflection).includes(branch)) {
    return setAreaWeight(reflection, branch, DEFAULT_AREA_WEIGHT);
  }
  const { [branch]: _removed, ...areaWeights } = reflection.areaWeights;
  const focusIds = reflection.focusIds.filter((id) => branchOfFocus(id) !== branch);
  return withoutOrphanedPrimary({ ...reflection, areaWeights }, focusIds);
}

export function setAreaWeight(
  reflection: FocusReflection,
  branch: SkillBranch,
  weight: AreaWeight,
): FocusReflection {
  return { ...reflection, areaWeights: { ...reflection.areaWeights, [branch]: weight } };
}

/** Mirrors how the skill tree credits a production session to its areas. */
export function areaTimeSplit(durationSeconds: number, reflection: FocusReflection): AreaTime[] {
  const countedSeconds = countedSkillSeconds(durationSeconds);
  const areas = reflectedAreas(reflection);
  const totalWeight = areas.reduce((sum, branch) => sum + weightOfArea(reflection, branch), 0);
  if (!countedSeconds || !totalWeight) return [];
  return areas.map((branch) => ({
    branch,
    seconds: Math.round((countedSeconds * weightOfArea(reflection, branch)) / totalWeight),
  }));
}

/** Same floor and cap as the server's `counted_session_seconds`. */
function countedSkillSeconds(durationSeconds: number): number {
  if (durationSeconds < MINIMUM_COUNTED_SESSION_SECONDS) return 0;
  return Math.min(durationSeconds, MAX_COUNTED_SESSION_SECONDS);
}

export function areaWeightsPayload(
  reflection: FocusReflection,
): { branch: SkillBranch; weight: AreaWeight }[] {
  return reflectedAreas(reflection).map((branch) => ({
    branch,
    weight: weightOfArea(reflection, branch),
  }));
}
