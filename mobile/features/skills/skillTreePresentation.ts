import {
  SKILL_BRANCHES,
  SKILL_FOCUSES,
  branchOfFocus,
  focusesForBranch,
  isSkillBranch,
  type SkillBranch,
  type SkillFocusId,
} from "../../constants/skills";
import type { SkillNodeDto, SkillProfileDto } from "../../types/skillProfile";
import { levelFraction } from "../sessions/skillProgressPresentation";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A focus counts as neglected once it has rested this long. */
export const NEGLECTED_AFTER_DAYS = 14;

export type SkillTreeNodeId = "center" | SkillBranch | SkillFocusId;

export type SkillNodeState = {
  isUnlocked: boolean;
  level: number;
  /** 0–1 progress within the current level. */
  levelFraction: number;
  totalSeconds: number;
  sessionCount: number;
  /** Null once the top level is reached. */
  secondsToNextLevel: number | null;
  lastTrainedAt: string | null;
};

export type SkillTreeModel = {
  branches: Record<SkillBranch, SkillNodeState>;
  focuses: Record<SkillFocusId, SkillNodeState>;
  totalSeconds: number;
  unlockedFocusCount: number;
  focusCount: number;
};

const LOCKED_NODE: SkillNodeState = {
  isUnlocked: false,
  level: 1,
  levelFraction: 0,
  totalSeconds: 0,
  sessionCount: 0,
  secondsToNextLevel: null,
  lastTrainedAt: null,
};

function nodeState(dto: SkillNodeDto | undefined): SkillNodeState {
  if (!dto || dto.total_seconds <= 0) return LOCKED_NODE;
  return {
    isUnlocked: true,
    level: dto.level,
    levelFraction: levelFraction(dto.total_seconds, dto.level_start_seconds, dto.next_level_seconds),
    totalSeconds: dto.total_seconds,
    sessionCount: dto.session_count,
    secondsToNextLevel:
      dto.next_level_seconds === null ? null : Math.max(0, dto.next_level_seconds - dto.total_seconds),
    lastTrainedAt: dto.last_trained_at,
  };
}

/** Without a profile every node is locked, which doubles as the loading silhouette. */
export function buildSkillTreeModel(profile: SkillProfileDto | null): SkillTreeModel {
  const branchDtos = new Map(profile?.branches.map((item) => [item.branch, item]));
  const focusDtos = new Map(profile?.focuses.map((item) => [item.skill_id, item]));
  const branches = Object.fromEntries(
    SKILL_BRANCHES.map((branch) => [branch, nodeState(branchDtos.get(branch))]),
  ) as Record<SkillBranch, SkillNodeState>;
  const focuses = Object.fromEntries(
    SKILL_FOCUSES.map(({ id }) => [id, nodeState(focusDtos.get(id))]),
  ) as Record<SkillFocusId, SkillNodeState>;
  return {
    branches,
    focuses,
    totalSeconds: profile?.total_seconds ?? 0,
    unlockedFocusCount: Object.values(focuses).filter((node) => node.isUnlocked).length,
    focusCount: SKILL_FOCUSES.length,
  };
}

/** Unlocked branches, most trained first. */
export function strongestBranches(model: SkillTreeModel, limit: number): SkillBranch[] {
  return SKILL_BRANCHES.filter((branch) => model.branches[branch].isUnlocked)
    .sort((a, b) => model.branches[b].totalSeconds - model.branches[a].totalSeconds)
    .slice(0, limit);
}

export function daysSince(isoDate: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(isoDate).getTime()) / DAY_MS));
}

/** The unlocked focus that has rested longest, once it has rested long enough to matter. */
export function neglectedFocus(
  model: SkillTreeModel,
  now: Date,
): { id: SkillFocusId; days: number } | null {
  let oldest: { id: SkillFocusId; days: number } | null = null;
  for (const { id } of SKILL_FOCUSES) {
    const { lastTrainedAt } = model.focuses[id];
    if (!lastTrainedAt) continue;
    const days = daysSince(lastTrainedAt, now);
    if (days >= NEGLECTED_AFTER_DAYS && (!oldest || days > oldest.days)) oldest = { id, days };
  }
  return oldest;
}

/** An edge lights up once the node it leads to is unlocked. */
export function isEdgeUnlocked(model: SkillTreeModel, toId: SkillBranch | SkillFocusId): boolean {
  return isSkillBranch(toId) ? model.branches[toId].isUnlocked : model.focuses[toId].isUnlocked;
}

export function unlockedFocusIds(model: SkillTreeModel): SkillFocusId[] {
  return SKILL_FOCUSES.map(({ id }) => id).filter((id) => model.focuses[id].isUnlocked);
}

/** Where the tree opens: the requested area, else the one trained most recently, else you. */
export function startingNodeId(
  model: SkillTreeModel,
  requestedBranch: string | undefined,
): "center" | SkillBranch {
  if (isSkillBranch(requestedBranch)) return requestedBranch;
  let latest: { branch: SkillBranch; trainedAt: number } | null = null;
  for (const branch of SKILL_BRANCHES) {
    const { lastTrainedAt } = model.branches[branch];
    if (!lastTrainedAt) continue;
    const trainedAt = new Date(lastTrainedAt).getTime();
    if (!latest || trainedAt > latest.trainedAt) latest = { branch, trainedAt };
  }
  return latest?.branch ?? "center";
}

/**
 * Nodes that stay lit while one is selected: the path from you to it, plus an area's skills.
 * Null means nothing is dimmed.
 */
export function highlightedNodeIds(
  selectedId: SkillTreeNodeId | null,
): ReadonlySet<SkillTreeNodeId> | null {
  if (!selectedId || selectedId === "center") return null;
  if (isSkillBranch(selectedId)) {
    return new Set<SkillTreeNodeId>([
      "center",
      selectedId,
      ...focusesForBranch(selectedId).map(({ id }) => id),
    ]);
  }
  return new Set<SkillTreeNodeId>(["center", branchOfFocus(selectedId), selectedId]);
}

/** Edges to retrace from you outward when a node is selected. */
export function tracedEdgeToIds(
  selectedId: SkillTreeNodeId | null,
): Array<SkillBranch | SkillFocusId> {
  if (!selectedId || selectedId === "center") return [];
  if (isSkillBranch(selectedId)) return [selectedId];
  return [branchOfFocus(selectedId), selectedId];
}

/** Where the unlock counter starts before it ticks up to the current total. */
export function unlockCountStart(unlocked: number, newCount: number) {
  return Math.max(0, unlocked - newCount);
}
