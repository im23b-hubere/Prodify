import { SKILL_BRANCHES, branchOfFocus, type SkillBranch, type SkillFocusId } from "../../constants/skills";
import { MINIMUM_COUNTED_SESSION_SECONDS } from "./sessionCompletePresentation";
import type { AreaTime } from "./areaWeights";

const MAX_COUNTED_SESSION_SECONDS = 12 * 3600;

export type SkillTimeAllocation = Partial<Record<SkillFocusId, number>>;

export function countedSkillSeconds(durationSeconds: number): number {
  if (durationSeconds < MINIMUM_COUNTED_SESSION_SECONDS) return 0;
  return Math.min(durationSeconds, MAX_COUNTED_SESSION_SECONDS);
}

export function allocateSkillTime(
  durationSeconds: number,
  focusIds: SkillFocusId[],
  assignedSeconds?: SkillTimeAllocation,
): SkillTimeAllocation {
  const counted = countedSkillSeconds(durationSeconds);
  if (!counted || focusIds.length === 0) return {};
  if (assignedSeconds && Object.keys(assignedSeconds).length > 0) {
    return allocateBudget(counted, focusIds, assignedSeconds);
  }
  const share = Math.round(counted / focusIds.length);
  return Object.fromEntries(focusIds.map((id) => [id, share]));
}

function allocateBudget(
  counted: number,
  focusIds: SkillFocusId[],
  assignedSeconds: SkillTimeAllocation,
): SkillTimeAllocation {
  let remaining = counted;
  const allocation: SkillTimeAllocation = {};
  for (const focusId of focusIds) {
    const raw = assignedSeconds[focusId] ?? 0;
    const seconds = Math.max(0, Math.min(raw, remaining));
    allocation[focusId] = seconds;
    remaining -= seconds;
  }
  return allocation;
}

export function unassignedSeconds(
  durationSeconds: number,
  assignedSeconds: SkillTimeAllocation,
): number {
  const counted = countedSkillSeconds(durationSeconds);
  const used = Object.values(assignedSeconds).reduce((sum, seconds) => sum + Math.max(0, seconds ?? 0), 0);
  return Math.max(0, counted - used);
}

export function wheelCapSeconds(
  durationSeconds: number,
  assignedSeconds: SkillTimeAllocation,
  focusId: SkillFocusId,
): number {
  const thisFocus = Math.max(0, assignedSeconds[focusId] ?? 0);
  return Math.min(
    countedSkillSeconds(durationSeconds),
    thisFocus + unassignedSeconds(durationSeconds, assignedSeconds),
  );
}

export function areaTimeFromSkillTime(allocation: SkillTimeAllocation): AreaTime[] {
  const byArea: Partial<Record<SkillBranch, number>> = {};
  for (const [focusId, seconds] of Object.entries(allocation)) {
    if (!seconds || seconds <= 0) continue;
    const area = branchOfFocus(focusId as SkillFocusId);
    byArea[area] = (byArea[area] ?? 0) + seconds;
  }
  return SKILL_BRANCHES.filter((branch) => (byArea[branch] ?? 0) > 0).map((branch) => ({
    branch,
    seconds: byArea[branch] ?? 0,
  }));
}

export function mainFocusId(allocation: SkillTimeAllocation): SkillFocusId | null {
  const entries = Object.entries(allocation) as [SkillFocusId, number][];
  const top = Math.max(0, ...entries.map(([, seconds]) => seconds));
  if (top <= 0) return null;
  const winners = entries.filter(([, seconds]) => seconds === top).map(([id]) => id);
  return winners.length === 1 ? winners[0] : null;
}
