import { buildSessionFeedback } from "../../lib/sessionFeedbackEngine";

const monday = new Date("2026-08-10T12:00:00Z");
const wednesday = new Date("2026-08-12T12:00:00Z");

describe("session feedback engine", () => {
  it("returns a strong-session fallback without a configured goal", () => {
    const result = buildSessionFeedback({
      weeklyGoalTarget: null,
      weekSessionsCount: 2,
      currentStreak: 0,
      sessionDurationSeconds: 45 * 60,
      now: monday,
    });

    expect(result.progressPercent).toBeNull();
    expect(result.emotionalMessageKey).toBe("sessionFeedback.emotion.strongSession");
    expect(result.nextActionKey).toBe("sessionFeedback.nextAction.keepPace");
  });

  it("prioritizes goal completion and streak protection", () => {
    const result = buildSessionFeedback({
      weeklyGoalTarget: 5,
      weekSessionsCount: 5,
      currentStreak: 3,
      sessionDurationSeconds: 600,
      now: monday,
    });

    expect(result.statusMessageKey).toBe("sessionFeedback.status.goalComplete");
    expect(result.nextActionKey).toBe("sessionFeedback.nextAction.goalHit");
    expect(result.emotionalMessageKey).toBe("sessionFeedback.emotion.protectedStreak");
  });

  it("detects when the completed session brings the producer back on track", () => {
    const result = buildSessionFeedback({
      weeklyGoalTarget: 7,
      weekSessionsCount: 3,
      currentStreak: 0,
      sessionDurationSeconds: 1200,
      now: wednesday,
    });

    expect(result.previousStatus).toBe("off_track");
    expect(result.newStatus).toBe("on_track");
    expect(result.statusMessageKey).toBe("sessionFeedback.status.backOnTrack");
    expect(result.nextActionKey).toBe("sessionFeedback.nextAction.keepPace");
  });

  it("selects the one-more and few-more actions from remaining sessions", () => {
    const oneMore = buildSessionFeedback({
      weeklyGoalTarget: 5,
      weekSessionsCount: 4,
      currentStreak: 0,
      sessionDurationSeconds: 1200,
      now: monday,
    });
    const fewMore = buildSessionFeedback({
      weeklyGoalTarget: 5,
      weekSessionsCount: 2,
      currentStreak: 0,
      sessionDurationSeconds: 1200,
      now: monday,
    });

    expect(oneMore.nextActionKey).toBe("sessionFeedback.nextAction.oneMore");
    expect(fewMore.nextActionKey).toBe("sessionFeedback.nextAction.fewMore");
    expect(fewMore.nextActionParams.sessions).toBe(3);
  });
});
