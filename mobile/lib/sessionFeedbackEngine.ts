import type { GoalTrackStatus } from "./goalPace";
import {
  classifyGoalTrackStatus,
  expectedWeeklySessionsByToday,
  weeklyGoalProgressPercent,
} from "./goalPace";

export type SessionFeedbackInput = {
  weeklyGoalTarget: number | null;
  weekSessionsCount: number;
  currentStreak: number;
  sessionDurationSeconds: number;
  now?: Date;
};

export type SessionFeedbackComputed = {
  progressPercent: number | null;
  remainingSessionsToGoal: number | null;
  previousStatus: GoalTrackStatus | null;
  newStatus: GoalTrackStatus;
  statusMessageKey:
    | "sessionFeedback.status.backOnTrack"
    | "sessionFeedback.status.movedAhead"
    | "sessionFeedback.status.onTrack"
    | "sessionFeedback.status.offTrack"
    | "sessionFeedback.status.goalComplete";
  emotionalMessageKey:
    | "sessionFeedback.emotion.protectedStreak"
    | "sessionFeedback.emotion.strongSession"
    | "sessionFeedback.emotion.solidConsistency";
  nextActionKey:
    | "sessionFeedback.nextAction.goalHit"
    | "sessionFeedback.nextAction.oneMore"
    | "sessionFeedback.nextAction.fewMore"
    | "sessionFeedback.nextAction.keepPace";
  nextActionParams: Record<string, number>;
  premiumPreview: {
    forecastReady: boolean;
    habitRiskReady: boolean;
    bestTimeReady: boolean;
  };
};

const STRONG_SESSION_SECONDS = 45 * 60;
const PREMIUM_PREVIEW = {
  forecastReady: true,
  habitRiskReady: true,
  bestTimeReady: true,
} as const;

function emotionalMessage(
  input: SessionFeedbackInput,
): SessionFeedbackComputed["emotionalMessageKey"] {
  if (input.currentStreak > 0) return "sessionFeedback.emotion.protectedStreak";
  if (input.sessionDurationSeconds >= STRONG_SESSION_SECONDS) {
    return "sessionFeedback.emotion.strongSession";
  }
  return "sessionFeedback.emotion.solidConsistency";
}

function statusMessage(
  remaining: number,
  previousStatus: GoalTrackStatus,
  newStatus: GoalTrackStatus,
): SessionFeedbackComputed["statusMessageKey"] {
  if (remaining === 0) return "sessionFeedback.status.goalComplete";
  if (previousStatus === "off_track" && newStatus !== "off_track") {
    return "sessionFeedback.status.backOnTrack";
  }
  if (newStatus === "off_track") return "sessionFeedback.status.offTrack";
  return "sessionFeedback.status.onTrack";
}

function nextAction(
  remaining: number,
): Pick<SessionFeedbackComputed, "nextActionKey" | "nextActionParams"> {
  if (remaining === 0) {
    return {
      nextActionKey: "sessionFeedback.nextAction.goalHit",
      nextActionParams: { sessions: 1, minutes: 30 },
    };
  }
  if (remaining === 1) {
    return {
      nextActionKey: "sessionFeedback.nextAction.oneMore",
      nextActionParams: { sessions: 1, minutes: 30 },
    };
  }
  if (remaining <= 3) {
    return {
      nextActionKey: "sessionFeedback.nextAction.fewMore",
      nextActionParams: { sessions: remaining, minutes: 30 },
    };
  }
  return {
    nextActionKey: "sessionFeedback.nextAction.keepPace",
    nextActionParams: { sessions: 1, minutes: 30 },
  };
}

function feedbackWithGoal(
  input: SessionFeedbackInput,
  weeklyGoalTarget: number,
  completedSessions: number,
  now: Date,
): SessionFeedbackComputed {
  const expectedByNow = expectedWeeklySessionsByToday(weeklyGoalTarget, now);
  const previousStatus = classifyGoalTrackStatus({
    weeklyGoalTarget,
    weekSessionsCount: Math.max(0, completedSessions - 1),
    expectedByNow,
  });
  const newStatus = classifyGoalTrackStatus({
    weeklyGoalTarget,
    weekSessionsCount: completedSessions,
    expectedByNow,
  });
  const remaining = Math.max(0, weeklyGoalTarget - completedSessions);
  return {
    progressPercent: weeklyGoalProgressPercent({
      weeklyGoalTarget,
      weekSessionsCount: completedSessions,
    }),
    remainingSessionsToGoal: remaining,
    previousStatus,
    newStatus,
    statusMessageKey: statusMessage(remaining, previousStatus, newStatus),
    emotionalMessageKey: emotionalMessage(input),
    ...nextAction(remaining),
    premiumPreview: PREMIUM_PREVIEW,
  };
}

export function buildSessionFeedback(input: SessionFeedbackInput): SessionFeedbackComputed {
  const now = input.now ?? new Date();
  const completedSessions = Math.max(0, input.weekSessionsCount);
  if (input.weeklyGoalTarget != null && input.weeklyGoalTarget > 0) {
    return feedbackWithGoal(input, input.weeklyGoalTarget, completedSessions, now);
  }
  return {
    progressPercent: null,
    remainingSessionsToGoal: null,
    previousStatus: null,
    newStatus: "on_track",
    statusMessageKey: "sessionFeedback.status.onTrack",
    emotionalMessageKey: emotionalMessage(input),
    nextActionKey: "sessionFeedback.nextAction.keepPace",
    nextActionParams: { sessions: 1, minutes: 30 },
    premiumPreview: PREMIUM_PREVIEW,
  };
}
