import type { SessionType } from "../../constants/sessionTypes";
import {
  focusesForBranch,
  skillBranchesForSessionType,
  type SkillBranch,
  type SkillFocusId,
} from "../../constants/skills";
import { countedSkillSeconds, type SkillTimeAllocation } from "./focusTime";
import { withoutOrphanedPrimary, type FocusReflection } from "./skillFocusReflection";

export function addCreditedFocus(
  reflection: FocusReflection,
  id: SkillFocusId,
  durationSeconds: number,
): FocusReflection {
  if (reflection.focusIds.includes(id)) return reflection;
  const focusIds = [...reflection.focusIds, id];
  return withEvenSplit({ ...reflection, focusIds }, durationSeconds);
}

export function removeCreditedFocus(
  reflection: FocusReflection,
  id: SkillFocusId,
  durationSeconds: number,
): FocusReflection {
  if (!reflection.focusIds.includes(id)) return reflection;
  const next = withoutOrphanedPrimary(
    reflection,
    reflection.focusIds.filter((current) => current !== id),
  );
  return withEvenSplit(next, durationSeconds);
}

/**
 * Makes the credited list match `ids`: drops focuses that are not in it, then adds the new ones
 * in order. Returns the same reflection when nothing changes.
 */
export function applyFocusList(
  reflection: FocusReflection,
  ids: readonly SkillFocusId[],
  durationSeconds: number,
): FocusReflection {
  const wanted = new Set(ids);
  let next = reflection;
  for (const id of reflection.focusIds) {
    if (!wanted.has(id)) next = removeCreditedFocus(next, id, durationSeconds);
  }
  for (const id of ids) next = addCreditedFocus(next, id, durationSeconds);
  return next;
}

export function setCreditedSeconds(
  reflection: FocusReflection,
  id: SkillFocusId,
  seconds: number,
  durationSeconds: number,
): FocusReflection {
  if (!reflection.focusIds.includes(id)) return reflection;
  const counted = countedSkillSeconds(durationSeconds);
  if (!counted || reflection.focusIds.length === 1) {
    return withEvenSplit(reflection, durationSeconds);
  }
  const thisSeconds = Math.max(0, Math.min(Math.floor(seconds), counted));
  const rest = splitEvenly(
    counted - thisSeconds,
    reflection.focusIds.filter((current) => current !== id),
  );
  const assignedSeconds: SkillTimeAllocation = {};
  for (const focusId of reflection.focusIds) {
    assignedSeconds[focusId] = focusId === id ? thisSeconds : (rest[focusId] ?? 0);
  }
  return { ...reflection, assignedSeconds };
}

export function ensureCredited(
  reflection: FocusReflection,
  durationSeconds: number,
): FocusReflection {
  if (Object.keys(reflection.assignedSeconds ?? {}).length > 0) return reflection;
  return withEvenSplit(reflection, durationSeconds);
}

export function remainingFocuses(
  sessionType: SessionType,
  selectedIds: readonly SkillFocusId[],
): { branch: SkillBranch; ids: SkillFocusId[] }[] {
  const selected = new Set(selectedIds);
  return skillBranchesForSessionType(sessionType)
    .map((branch) => ({
      branch,
      ids: focusesForBranch(branch)
        .map((focus) => focus.id)
        .filter((id) => !selected.has(id)),
    }))
    .filter((group) => group.ids.length > 0);
}

function withEvenSplit(reflection: FocusReflection, durationSeconds: number): FocusReflection {
  return {
    ...reflection,
    assignedSeconds: splitEvenly(countedSkillSeconds(durationSeconds), reflection.focusIds),
  };
}

function splitEvenly(total: number, focusIds: SkillFocusId[]): SkillTimeAllocation {
  if (total <= 0 || focusIds.length === 0) return {};
  const base = Math.floor(total / focusIds.length);
  let extra = total % focusIds.length;
  const assigned: SkillTimeAllocation = {};
  for (const id of focusIds) {
    assigned[id] = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
  }
  return assigned;
}
