import {
  DEFAULT_SESSION_TYPE,
  SESSION_TYPE_IDS,
  type SessionType,
} from "../constants/sessionTypes";
import { classifyGoalTrackStatus, expectedWeeklySessionsByToday } from "./goalPace";

const STREAK_RISK_HOURS = 30;

export type TodayPlanStatus = "off_track" | "on_track" | "ahead";

export type TodayPlanCopyKey =
  | "todayPlan.recommendation.offTrackOne"
  | "todayPlan.recommendation.offTrackMany"
  | "todayPlan.recommendation.streakRisk"
  | "todayPlan.recommendation.onTrack"
  | "todayPlan.recommendation.ahead"
  | "todayPlan.recommendation.fallback";

export type TodayPlanFeedbackPreview = {
  weeklyGoalPercentAfterSession: number;
  sessionsRemainingAfterSuggested: number;
  backOnTrackAfterSuggested: boolean;
};

export type TodayPlanRecommendation = {
  status: TodayPlanStatus;
  messageKey: TodayPlanCopyKey;
  messageParams: Record<string, number>;
  suggestedSessionType: SessionType;
  suggestedSessionsToday: number;
  suggestedDurationMin: number;
  feedbackPreview: TodayPlanFeedbackPreview | null;
};

export type TodayPlanInput = {
  weeklyGoalTarget: number | null;
  weekSessionsCount: number;
  currentStreak: number;
  streakAtRisk: boolean;
  lastSessionAt: string | null;
  lastSessionType: string | null;
  now?: Date;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toMondayIndexedDay(day: number): number {
  return day === 0 ? 7 : day;
}

function suggestedType(lastSessionType: string | null): SessionType {
  if (!lastSessionType) return DEFAULT_SESSION_TYPE;
  return SESSION_TYPE_IDS.includes(lastSessionType as SessionType)
    ? (lastSessionType as SessionType)
    : DEFAULT_SESSION_TYPE;
}

function hoursSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const parsed = new Date(iso).getTime();
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, (now.getTime() - parsed) / (1000 * 60 * 60));
}

function buildFeedbackPreview(
  weeklyGoalTarget: number,
  weekSessionsCount: number,
  expectedByNow: number,
  suggestedSessionsToday: number,
): TodayPlanFeedbackPreview {
  const projectedSessions = weekSessionsCount + suggestedSessionsToday;
  const pct = clamp(Math.round((projectedSessions / weeklyGoalTarget) * 100), 0, 999);
  return {
    weeklyGoalPercentAfterSession: pct,
    sessionsRemainingAfterSuggested: Math.max(0, weeklyGoalTarget - projectedSessions),
    backOnTrackAfterSuggested: projectedSessions >= expectedByNow,
  };
}

export function buildTodayPlanRecommendation(input: TodayPlanInput): TodayPlanRecommendation {
  const now = input.now ?? new Date();
  const type = suggestedType(input.lastSessionType);
  const streakHours = hoursSince(input.lastSessionAt, now);
  const streakNeedsProtection =
    input.streakAtRisk || (input.currentStreak > 0 && (streakHours ?? 0) >= STREAK_RISK_HOURS);

  if (input.weeklyGoalTarget != null && input.weeklyGoalTarget > 0) {
    const dayOfWeek = toMondayIndexedDay(now.getDay());
    const expectedByNow = expectedWeeklySessionsByToday(input.weeklyGoalTarget, now);
    const deficit = expectedByNow - input.weekSessionsCount;
    const sessionsRemainingThisWeek = Math.max(0, input.weeklyGoalTarget - input.weekSessionsCount);
    const daysLeftIncludingToday = Math.max(1, 8 - dayOfWeek);
    const minimumTodayForGoal = Math.ceil(sessionsRemainingThisWeek / daysLeftIncludingToday);

    if (deficit >= 2 || sessionsRemainingThisWeek > daysLeftIncludingToday) {
      const suggestedSessionsToday = clamp(Math.max(1, minimumTodayForGoal), 1, 3);
      return {
        status: "off_track",
        messageKey:
          suggestedSessionsToday <= 1
            ? "todayPlan.recommendation.offTrackOne"
            : "todayPlan.recommendation.offTrackMany",
        messageParams: {
          sessions: suggestedSessionsToday,
          minutes: suggestedSessionsToday > 1 ? 30 : 45,
        },
        suggestedSessionType: type,
        suggestedSessionsToday,
        suggestedDurationMin: suggestedSessionsToday > 1 ? 30 : 45,
        feedbackPreview: buildFeedbackPreview(
          input.weeklyGoalTarget,
          input.weekSessionsCount,
          expectedByNow,
          suggestedSessionsToday,
        ),
      };
    }

    if (streakNeedsProtection) {
      return {
        status: "off_track",
        messageKey: "todayPlan.recommendation.streakRisk",
        messageParams: { sessions: 1, minutes: 30 },
        suggestedSessionType: type,
        suggestedSessionsToday: 1,
        suggestedDurationMin: 30,
        feedbackPreview: buildFeedbackPreview(
          input.weeklyGoalTarget,
          input.weekSessionsCount,
          expectedByNow,
          1,
        ),
      };
    }

    const trackStatus = classifyGoalTrackStatus({
      weeklyGoalTarget: input.weeklyGoalTarget,
      weekSessionsCount: input.weekSessionsCount,
      expectedByNow,
    });
    const ahead = trackStatus === "ahead";
    return {
      status: ahead ? "ahead" : "on_track",
      messageKey: ahead ? "todayPlan.recommendation.ahead" : "todayPlan.recommendation.onTrack",
      messageParams: { sessions: 1, minutes: 45 },
      suggestedSessionType: type,
      suggestedSessionsToday: 1,
      suggestedDurationMin: 45,
      feedbackPreview: buildFeedbackPreview(
        input.weeklyGoalTarget,
        input.weekSessionsCount,
        expectedByNow,
        1,
      ),
    };
  }

  if (streakNeedsProtection) {
    return {
      status: "off_track",
      messageKey: "todayPlan.recommendation.streakRisk",
      messageParams: { sessions: 1, minutes: 30 },
      suggestedSessionType: type,
      suggestedSessionsToday: 1,
      suggestedDurationMin: 30,
      feedbackPreview: null,
    };
  }

  return {
    status: "on_track",
    messageKey: "todayPlan.recommendation.fallback",
    messageParams: { sessions: 1, minutes: 45 },
    suggestedSessionType: type,
    suggestedSessionsToday: 1,
    suggestedDurationMin: 45,
    feedbackPreview: null,
  };
}
