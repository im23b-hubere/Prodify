import type { SocialChallengeDto } from "../../types/friends";

/** Mirrors `SocialChallengeCreateBody` in the backend contract. */
export const CHALLENGE_LIMITS = {
  minTargetSessions: 1,
  maxTargetSessions: 50,
  minDurationDays: 3,
  maxDurationDays: 30,
  minTitleLength: 3,
  maxTitleLength: 120,
} as const;

export type ChallengePresetId = "warmup" | "classic" | "grind";

export type ChallengePreset = {
  id: ChallengePresetId;
  targetSessions: number;
  durationDays: number;
};

export const CHALLENGE_PRESETS: readonly ChallengePreset[] = [
  { id: "warmup", targetSessions: 3, durationDays: 3 },
  { id: "classic", targetSessions: 5, durationDays: 7 },
  { id: "grind", targetSessions: 10, durationDays: 14 },
];

const DEFAULT_PRESET = CHALLENGE_PRESETS[1];

export const CHALLENGE_STEPS = ["friend", "goal", "review"] as const;
export type ChallengeStep = (typeof CHALLENGE_STEPS)[number];

export type ChallengeDraft = {
  step: ChallengeStep;
  friendId: number | null;
  targetSessions: number;
  durationDays: number;
  /** `null` keeps the generated "You vs Friend" title. */
  customTitle: string | null;
};

export type ChallengeDraftAction =
  | { type: "selectFriend"; friendId: number }
  | { type: "choosePreset"; presetId: ChallengePresetId }
  | { type: "stepTarget"; delta: number }
  | { type: "stepDuration"; delta: number }
  | { type: "editTitle"; title: string }
  | { type: "useGeneratedTitle" }
  | { type: "next" }
  | { type: "back" };

export function createChallengeDraft({
  friendId = null,
}: { friendId?: number | null } = {}): ChallengeDraft {
  return {
    step: friendId == null ? "friend" : "goal",
    friendId,
    targetSessions: DEFAULT_PRESET.targetSessions,
    durationDays: DEFAULT_PRESET.durationDays,
    customTitle: null,
  };
}

export function challengeDraftReducer(
  draft: ChallengeDraft,
  action: ChallengeDraftAction,
): ChallengeDraft {
  switch (action.type) {
    case "selectFriend":
      return draft.friendId === action.friendId ? draft : { ...draft, friendId: action.friendId };
    case "choosePreset":
      return applyPreset(draft, action.presetId);
    case "stepTarget":
      return { ...draft, targetSessions: clampTarget(draft.targetSessions + action.delta) };
    case "stepDuration":
      return { ...draft, durationDays: clampDuration(draft.durationDays + action.delta) };
    case "editTitle":
      return { ...draft, customTitle: action.title };
    case "useGeneratedTitle":
      return draft.customTitle === null ? draft : { ...draft, customTitle: null };
    case "next":
      return moveStep(draft, 1);
    case "back":
      return moveStep(draft, -1);
  }
}

function applyPreset(draft: ChallengeDraft, presetId: ChallengePresetId): ChallengeDraft {
  const preset = CHALLENGE_PRESETS.find((item) => item.id === presetId);
  if (!preset) return draft;
  return { ...draft, targetSessions: preset.targetSessions, durationDays: preset.durationDays };
}

function moveStep(draft: ChallengeDraft, offset: 1 | -1): ChallengeDraft {
  const nextStep = CHALLENGE_STEPS[CHALLENGE_STEPS.indexOf(draft.step) + offset];
  return nextStep ? { ...draft, step: nextStep } : draft;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampTarget(value: number) {
  return clamp(value, CHALLENGE_LIMITS.minTargetSessions, CHALLENGE_LIMITS.maxTargetSessions);
}

function clampDuration(value: number) {
  return clamp(value, CHALLENGE_LIMITS.minDurationDays, CHALLENGE_LIMITS.maxDurationDays);
}

/** The preset matching the current numbers, or `null` when the user tuned them by hand. */
export function matchingPresetId(draft: ChallengeDraft): ChallengePresetId | null {
  const match = CHALLENGE_PRESETS.find(
    (preset) =>
      preset.targetSessions === draft.targetSessions && preset.durationDays === draft.durationDays,
  );
  return match?.id ?? null;
}

export function stepperBounds(draft: ChallengeDraft) {
  return {
    canDecreaseTarget: draft.targetSessions > CHALLENGE_LIMITS.minTargetSessions,
    canIncreaseTarget: draft.targetSessions < CHALLENGE_LIMITS.maxTargetSessions,
    canDecreaseDuration: draft.durationDays > CHALLENGE_LIMITS.minDurationDays,
    canIncreaseDuration: draft.durationDays < CHALLENGE_LIMITS.maxDurationDays,
  };
}

/** Sessions per week the goal asks for, rounded to one decimal. */
export function weeklyPace(draft: ChallengeDraft) {
  return Math.round((draft.targetSessions / draft.durationDays) * 7 * 10) / 10;
}

export type FriendDuelStatus = "available" | "invite_pending" | "in_duel";

/** Only an open invite blocks a new one; a running duel is shown for context. */
export function friendDuelStatus(
  friendId: number,
  challenges: SocialChallengeDto[],
  userId: number | undefined,
): FriendDuelStatus {
  if (userId == null) return "available";
  const duels = challenges.filter((challenge) => challenge.challenge_kind === "duel");
  if (duels.some((duel) => duel.status === "pending" && isInviteBetween(duel, userId, friendId))) {
    return "invite_pending";
  }
  if (duels.some((duel) => duel.status === "active" && hasMembers(duel, [userId, friendId]))) {
    return "in_duel";
  }
  return "available";
}

function isInviteBetween(duel: SocialChallengeDto, userId: number, friendId: number) {
  const pair = new Set([duel.owner_id, duel.invitee_user_id]);
  return pair.has(userId) && pair.has(friendId);
}

function hasMembers(duel: SocialChallengeDto, userIds: number[]) {
  const memberIds = new Set(duel.members.map((member) => member.user_id));
  return userIds.every((id) => memberIds.has(id));
}

export function generatedChallengeTitle(yourName: string, friendName: string) {
  return `${yourName} vs ${friendName}`.slice(0, CHALLENGE_LIMITS.maxTitleLength);
}

export function resolvedChallengeTitle(
  draft: ChallengeDraft,
  yourName: string,
  friendName: string,
) {
  return draft.customTitle?.trim() || generatedChallengeTitle(yourName, friendName);
}

export type ChallengeDraftIssue =
  | "pick_friend"
  | "invite_pending"
  | "title_too_short"
  | "title_too_long";

/**
 * The first reason the given step cannot continue, or `null` when it can.
 * Friend problems block every step, so a preselected friend with an open invite cannot slip through.
 * `friendStatus` is `null` when the selected friend is not in the friend list.
 */
export function challengeStepIssue(
  draft: ChallengeDraft,
  step: ChallengeStep,
  context: { friendStatus: FriendDuelStatus | null; title: string },
): ChallengeDraftIssue | null {
  if (draft.friendId == null || context.friendStatus == null) return "pick_friend";
  if (context.friendStatus === "invite_pending") return "invite_pending";
  if (step !== "review") return null;
  if (context.title.length < CHALLENGE_LIMITS.minTitleLength) return "title_too_short";
  if (context.title.length > CHALLENGE_LIMITS.maxTitleLength) return "title_too_long";
  return null;
}

export type DuelCreateRequest = {
  challenge_kind: "duel";
  title: string;
  target_sessions: number;
  duration_days: number;
  member_user_ids: number[];
};

export function duelCreateRequest(draft: ChallengeDraft, title: string): DuelCreateRequest | null {
  if (draft.friendId == null) return null;
  return {
    challenge_kind: "duel",
    title,
    target_sessions: draft.targetSessions,
    duration_days: draft.durationDays,
    member_user_ids: [draft.friendId],
  };
}
