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

function recommendation(input: {
  status: TodayPlanStatus;
  messageKey: TodayPlanCopyKey;
  type: SessionType;
  sessions: number;
  minutes: number;
  feedbackPreview: TodayPlanFeedbackPreview | null;
}): TodayPlanRecommendation {
  return {
    status: input.status,
    messageKey: input.messageKey,
    messageParams: { sessions: input.sessions, minutes: input.minutes },
    suggestedSessionType: input.type,
    suggestedSessionsToday: input.sessions,
    suggestedDurationMin: input.minutes,
    feedbackPreview: input.feedbackPreview,
  };
}

function streakProtectionPlan(
  type: SessionType,
  feedbackPreview: TodayPlanFeedbackPreview | null,
): TodayPlanRecommendation {
  return recommendation({
    status: "off_track",
    messageKey: "todayPlan.recommendation.streakRisk",
    type,
    sessions: 1,
    minutes: 30,
    feedbackPreview,
  });
}

function goalPlan(options: {
  input: TodayPlanInput;
  weeklyGoalTarget: number;
  type: SessionType;
  streakNeedsProtection: boolean;
  now: Date;
}): TodayPlanRecommendation {
  const { input, weeklyGoalTarget, type, streakNeedsProtection, now } = options;
  const dayOfWeek = toMondayIndexedDay(now.getDay());
  const expectedByNow = expectedWeeklySessionsByToday(weeklyGoalTarget, now);
  const deficit = expectedByNow - input.weekSessionsCount;
  const remaining = Math.max(0, weeklyGoalTarget - input.weekSessionsCount);
  const daysLeft = Math.max(1, 8 - dayOfWeek);
  const minimumToday = Math.ceil(remaining / daysLeft);
  if (deficit >= 2 || remaining > daysLeft) {
    const sessions = clamp(Math.max(1, minimumToday), 1, 3);
    const minutes = sessions > 1 ? 30 : 45;
    const messageKey =
      sessions <= 1
        ? "todayPlan.recommendation.offTrackOne"
        : "todayPlan.recommendation.offTrackMany";
    return recommendation({
      status: "off_track",
      messageKey,
      type,
      sessions,
      minutes,
      feedbackPreview: buildFeedbackPreview(
        weeklyGoalTarget,
        input.weekSessionsCount,
        expectedByNow,
        sessions,
      ),
    });
  }
  const preview = buildFeedbackPreview(weeklyGoalTarget, input.weekSessionsCount, expectedByNow, 1);
  if (streakNeedsProtection) return streakProtectionPlan(type, preview);
  const status = classifyGoalTrackStatus({
    weeklyGoalTarget,
    weekSessionsCount: input.weekSessionsCount,
    expectedByNow,
  });
  const ahead = status === "ahead";
  return recommendation({
    status: ahead ? "ahead" : "on_track",
    messageKey: ahead ? "todayPlan.recommendation.ahead" : "todayPlan.recommendation.onTrack",
    type,
    sessions: 1,
    minutes: 45,
    feedbackPreview: preview,
  });
}

export function buildTodayPlanRecommendation(input: TodayPlanInput): TodayPlanRecommendation {
  const now = input.now ?? new Date();
  const type = suggestedType(input.lastSessionType);
  const streakHours = hoursSince(input.lastSessionAt, now);
  const streakNeedsProtection =
    input.streakAtRisk || (input.currentStreak > 0 && (streakHours ?? 0) >= STREAK_RISK_HOURS);

  if (input.weeklyGoalTarget != null && input.weeklyGoalTarget > 0) {
    return goalPlan({
      input,
      weeklyGoalTarget: input.weeklyGoalTarget,
      type,
      streakNeedsProtection,
      now,
    });
  }

  if (streakNeedsProtection) return streakProtectionPlan(type, null);
  return recommendation({
    status: "on_track",
    messageKey: "todayPlan.recommendation.fallback",
    type,
    sessions: 1,
    minutes: 45,
    feedbackPreview: null,
  });
}
