import { WEEKLY_GOALS, sessionsPerWeekday } from "../../../features/onboarding/onboardingConfig";

describe("sessionsPerWeekday", () => {
  it("spreads each target over the week without losing a session", () => {
    for (const goal of WEEKLY_GOALS) {
      const days = sessionsPerWeekday(goal);
      expect(days).toHaveLength(7);
      expect(days.reduce((sum, count) => sum + count, 0)).toBe(goal);
      expect(Math.max(...days) - Math.min(...days)).toBeLessThanOrEqual(1);
    }
  });

  it("puts short weeks on spaced-out weekdays", () => {
    expect(sessionsPerWeekday(3)).toEqual([1, 0, 1, 0, 1, 0, 0]);
    expect(sessionsPerWeekday(5)).toEqual([1, 1, 1, 1, 1, 0, 0]);
    expect(sessionsPerWeekday(10)).toEqual([2, 1, 2, 1, 2, 1, 1]);
    expect(sessionsPerWeekday(14)).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });

  it("only ever adds sessions as the target rises", () => {
    for (let index = 1; index < WEEKLY_GOALS.length; index += 1) {
      const lower = sessionsPerWeekday(WEEKLY_GOALS[index - 1]!);
      const higher = sessionsPerWeekday(WEEKLY_GOALS[index]!);
      lower.forEach((count, day) => expect(higher[day]).toBeGreaterThanOrEqual(count));
    }
  });
});
