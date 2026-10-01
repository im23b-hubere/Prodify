import {
  DEFAULT_AREA_WEIGHT,
  SKILL_BRANCHES,
  branchOfFocus,
  type AreaWeight,
  type SkillBranch,
} from "../../constants/skills";
import { withoutOrphanedPrimary, type FocusReflection } from "./skillFocusReflection";

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
  const areas = reflectedAreas(reflection);
  const totalWeight = areas.reduce((sum, branch) => sum + weightOfArea(reflection, branch), 0);
  if (!durationSeconds || !totalWeight) return [];
  return areas.map((branch) => ({
    branch,
    seconds: Math.round((durationSeconds * weightOfArea(reflection, branch)) / totalWeight),
  }));
}

export function areaWeightsPayload(
  reflection: FocusReflection,
): { branch: SkillBranch; weight: AreaWeight }[] {
  return reflectedAreas(reflection).map((branch) => ({
    branch,
    weight: weightOfArea(reflection, branch),
  }));
}
