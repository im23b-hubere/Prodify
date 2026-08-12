import { DEFAULT_SESSION_TYPE } from "../../constants/sessionTypes";
import { buildTodayPlanRecommendation } from "../../lib/todayPlanEngine";

const monday = new Date("2026-08-10T12:00:00Z");
const sunday = new Date("2026-08-16T12:00:00Z");

function input(overrides: Partial<Parameters<typeof buildTodayPlanRecommendation>[0]> = {}) {
  return {
    weeklyGoalTarget: null,
    weekSessionsCount: 0,
    currentStreak: 0,
    streakAtRisk: false,
    lastSessionAt: null,
    lastSessionType: null,
    now: monday,
    ...overrides,
  };
}

describe("today plan engine", () => {
  it("returns a safe fallback and normalizes an unknown session type", () => {
    const result = buildTodayPlanRecommendation(input({ lastSessionType: "unknown" }));

    expect(result.messageKey).toBe("todayPlan.recommendation.fallback");
    expect(result.suggestedSessionType).toBe(DEFAULT_SESSION_TYPE);
    expect(result.feedbackPreview).toBeNull();
  });

  it("protects an existing streak after thirty hours without a session", () => {
    const result = buildTodayPlanRecommendation(
      input({
        currentStreak: 4,
        lastSessionAt: "2026-08-09T05:00:00Z",
      }),
    );

    expect(result.messageKey).toBe("todayPlan.recommendation.streakRisk");
    expect(result.suggestedDurationMin).toBe(30);
  });

  it("suggests multiple short sessions for a severe end-of-week deficit", () => {
    const result = buildTodayPlanRecommendation(
      input({ weeklyGoalTarget: 7, weekSessionsCount: 0, now: sunday }),
    );

    expect(result.messageKey).toBe("todayPlan.recommendation.offTrackMany");
    expect(result.suggestedSessionsToday).toBe(3);
    expect(result.suggestedDurationMin).toBe(30);
    expect(result.feedbackPreview?.weeklyGoalPercentAfterSession).toBe(43);
  });

  it("distinguishes on-track progress from a completed goal", () => {
    const onTrack = buildTodayPlanRecommendation(
      input({ weeklyGoalTarget: 7, weekSessionsCount: 1 }),
    );
    const ahead = buildTodayPlanRecommendation(
      input({ weeklyGoalTarget: 5, weekSessionsCount: 5 }),
    );

    expect(onTrack.messageKey).toBe("todayPlan.recommendation.onTrack");
    expect(ahead.messageKey).toBe("todayPlan.recommendation.ahead");
  });
});
