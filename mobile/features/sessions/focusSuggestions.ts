import type { SessionType } from "../../constants/sessionTypes";
import {
  MAX_PLANNED_FOCUSES_PER_SESSION,
  focusesForBranch,
  skillBranchesForSessionType,
  type SkillFocusId,
} from "../../constants/skills";
import {
  NEGLECTED_AFTER_DAYS,
  daysSince,
  type SkillTreeModel,
} from "../skills/skillTreePresentation";

/** A level-up counts as close once it fits into one typical session. */
export const LEVEL_UP_WITHIN_SECONDS = 45 * 60;
export const KEEP_GOING_WITHIN_DAYS = 7;

export type FocusSuggestion =
  | { id: SkillFocusId; reason: "levelUp"; secondsToNextLevel: number; nextLevel: number }
  | { id: SkillFocusId; reason: "resting"; days: number }
  | { id: SkillFocusId; reason: "keepGoing"; level: number }
  | { id: SkillFocusId; reason: "discover" };

/**
 * Up to two focuses worth training in a session of this type, best reason first. Each reason
 * contributes its strongest candidate before any reason repeats; undiscovered skills only fill
 * the slots nothing else claims.
 */
export function suggestFocuses(
  model: SkillTreeModel,
  sessionType: SessionType,
  now: Date,
): FocusSuggestion[] {
  const allowedIds = skillBranchesForSessionType(sessionType).flatMap((branch) =>
    focusesForBranch(branch).map(({ id }) => id),
  );
  const rankedByReason: FocusSuggestion[][] = [
    levelUpCandidates(model, allowedIds),
    restingCandidates(model, allowedIds, now),
    keepGoingCandidates(model, allowedIds, now),
  ];
  const picks = new Map<SkillFocusId, FocusSuggestion>();
  const add = (candidate: FocusSuggestion | undefined) => {
    if (!candidate || picks.has(candidate.id)) return;
    if (picks.size < MAX_PLANNED_FOCUSES_PER_SESSION) picks.set(candidate.id, candidate);
  };

  rankedByReason.forEach((candidates) => add(candidates.find(({ id }) => !picks.has(id))));
  rankedByReason.flat().forEach(add);
  discoverCandidates(model, sessionType).forEach(add);
  return [...picks.values()];
}

type SuggestionFor<Reason extends FocusSuggestion["reason"]> = Extract<
  FocusSuggestion,
  { reason: Reason }
>;

function levelUpCandidates(model: SkillTreeModel, ids: SkillFocusId[]): SuggestionFor<"levelUp">[] {
  return ids
    .flatMap((id): SuggestionFor<"levelUp">[] => {
      const { isUnlocked, secondsToNextLevel, level } = model.focuses[id];
      if (!isUnlocked || secondsToNextLevel === null) return [];
      if (secondsToNextLevel > LEVEL_UP_WITHIN_SECONDS) return [];
      return [{ id, reason: "levelUp", secondsToNextLevel, nextLevel: level + 1 }];
    })
    .sort((a, b) => a.secondsToNextLevel - b.secondsToNextLevel);
}

function restingCandidates(
  model: SkillTreeModel,
  ids: SkillFocusId[],
  now: Date,
): SuggestionFor<"resting">[] {
  return ids
    .flatMap((id): SuggestionFor<"resting">[] => {
      const { lastTrainedAt } = model.focuses[id];
      if (!lastTrainedAt) return [];
      const days = daysSince(lastTrainedAt, now);
      return days >= NEGLECTED_AFTER_DAYS ? [{ id, reason: "resting", days }] : [];
    })
    .sort((a, b) => b.days - a.days);
}

function keepGoingCandidates(
  model: SkillTreeModel,
  ids: SkillFocusId[],
  now: Date,
): SuggestionFor<"keepGoing">[] {
  return ids
    .filter((id) => {
      const { lastTrainedAt } = model.focuses[id];
      return lastTrainedAt !== null && daysSince(lastTrainedAt, now) < KEEP_GOING_WITHIN_DAYS;
    })
    .sort((a, b) => trainedAt(model, b) - trainedAt(model, a))
    .map((id) => ({ id, reason: "keepGoing" as const, level: model.focuses[id].level }));
}

/** The next locked skill of each area, so several areas get a turn before one repeats. */
function discoverCandidates(
  model: SkillTreeModel,
  sessionType: SessionType,
): SuggestionFor<"discover">[] {
  const lockedByBranch = skillBranchesForSessionType(sessionType).map((branch) =>
    focusesForBranch(branch).filter(({ id }) => !model.focuses[id].isUnlocked),
  );
  const depth = Math.max(0, ...lockedByBranch.map((focuses) => focuses.length));
  return Array.from({ length: depth }, (_, index) =>
    lockedByBranch.flatMap((focuses) => (focuses[index] ? [focuses[index].id] : [])),
  )
    .flat()
    .map((id) => ({ id, reason: "discover" as const }));
}

function trainedAt(model: SkillTreeModel, id: SkillFocusId): number {
  const { lastTrainedAt } = model.focuses[id];
  return lastTrainedAt ? new Date(lastTrainedAt).getTime() : 0;
}
