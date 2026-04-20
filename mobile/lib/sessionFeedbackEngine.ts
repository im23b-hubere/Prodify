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

export function buildSessionFeedback(input: SessionFeedbackInput): SessionFeedbackComputed {
  const now = input.now ?? new Date();
  const completedSessions = Math.max(0, input.weekSessionsCount);

  if (input.weeklyGoalTarget != null && input.weeklyGoalTarget > 0) {
    const expectedByNow = expectedWeeklySessionsByToday(input.weeklyGoalTarget, now);
    const previousCount = Math.max(0, completedSessions - 1);
    const previousStatus = classifyGoalTrackStatus({
      weeklyGoalTarget: input.weeklyGoalTarget,
      weekSessionsCount: previousCount,
      expectedByNow,
    });
    const newStatus = classifyGoalTrackStatus({
      weeklyGoalTarget: input.weeklyGoalTarget,
      weekSessionsCount: completedSessions,
      expectedByNow,
    });
    const remaining = Math.max(0, input.weeklyGoalTarget - completedSessions);
    const progressPercent = weeklyGoalProgressPercent({
      weeklyGoalTarget: input.weeklyGoalTarget,
      weekSessionsCount: completedSessions,
    });

    let statusMessageKey: SessionFeedbackComputed["statusMessageKey"] =
      "sessionFeedback.status.onTrack";
    if (remaining === 0) {
      statusMessageKey = "sessionFeedback.status.goalComplete";
    } else if (
      previousStatus === "off_track" &&
      (newStatus === "on_track" || newStatus === "ahead")
    ) {
      statusMessageKey = "sessionFeedback.status.backOnTrack";
    } else if (previousStatus === "on_track" && newStatus === "ahead") {
      statusMessageKey = "sessionFeedback.status.movedAhead";
    } else if (newStatus === "off_track") {
      statusMessageKey = "sessionFeedback.status.offTrack";
    }

    const emotionalMessageKey: SessionFeedbackComputed["emotionalMessageKey"] =
      input.currentStreak > 0
        ? "sessionFeedback.emotion.protectedStreak"
        : input.sessionDurationSeconds >= STRONG_SESSION_SECONDS
          ? "sessionFeedback.emotion.strongSession"
          : "sessionFeedback.emotion.solidConsistency";

    let nextActionKey: SessionFeedbackComputed["nextActionKey"] =
      "sessionFeedback.nextAction.keepPace";
    let nextActionParams: Record<string, number> = { sessions: 1, minutes: 30 };
    if (remaining === 0) {
      nextActionKey = "sessionFeedback.nextAction.goalHit";
    } else if (remaining === 1) {
      nextActionKey = "sessionFeedback.nextAction.oneMore";
      nextActionParams = { sessions: 1, minutes: 30 };
    } else if (remaining <= 3) {
      nextActionKey = "sessionFeedback.nextAction.fewMore";
      nextActionParams = { sessions: remaining, minutes: 30 };
    }

    return {
      progressPercent,
      remainingSessionsToGoal: remaining,
      previousStatus,
      newStatus,
      statusMessageKey,
      emotionalMessageKey,
      nextActionKey,
      nextActionParams,
      premiumPreview: {
        forecastReady: true,
        habitRiskReady: true,
        bestTimeReady: true,
      },
    };
  }

  return {
    progressPercent: null,
    remainingSessionsToGoal: null,
    previousStatus: null,
    newStatus: "on_track",
    statusMessageKey: "sessionFeedback.status.onTrack",
    emotionalMessageKey:
      input.currentStreak > 0
        ? "sessionFeedback.emotion.protectedStreak"
        : input.sessionDurationSeconds >= STRONG_SESSION_SECONDS
          ? "sessionFeedback.emotion.strongSession"
          : "sessionFeedback.emotion.solidConsistency",
    nextActionKey: "sessionFeedback.nextAction.keepPace",
    nextActionParams: { sessions: 1, minutes: 30 },
    premiumPreview: {
      forecastReady: true,
      habitRiskReady: true,
      bestTimeReady: true,
    },
  };
}
