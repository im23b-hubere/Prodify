import { dashboardGreetingKey, dashboardSparkKey } from "../../../features/dashboard/dashboardCopy";

describe("dashboardGreetingKey", () => {
  it("maps hours to greeting windows", () => {
    expect(dashboardGreetingKey(new Date(2026, 8, 1, 3))).toBe("dashboard.greeting.night");
    expect(dashboardGreetingKey(new Date(2026, 8, 1, 9))).toBe("dashboard.greeting.morning");
    expect(dashboardGreetingKey(new Date(2026, 8, 1, 14))).toBe("dashboard.greeting.afternoon");
    expect(dashboardGreetingKey(new Date(2026, 8, 1, 20))).toBe("dashboard.greeting.evening");
    expect(dashboardGreetingKey(new Date(2026, 8, 1, 23))).toBe("dashboard.greeting.night");
  });
});

describe("dashboardSparkKey", () => {
  const noon = new Date(2026, 8, 1, 12);

  it("prioritizes streak risk, then goal, then today, then streak", () => {
    expect(
      dashboardSparkKey({
        streakAtRisk: true,
        streakCount: 8,
        todayMinutes: 40,
        weeklyGoalComplete: true,
        now: noon,
      }).key,
    ).toBe("dashboard.spark.atRisk");
    expect(
      dashboardSparkKey({
        streakAtRisk: false,
        streakCount: 4,
        todayMinutes: 20,
        weeklyGoalComplete: true,
        now: noon,
      }).key,
    ).toBe("dashboard.spark.goalDone");
    expect(
      dashboardSparkKey({
        streakAtRisk: false,
        streakCount: 4,
        todayMinutes: 20,
        weeklyGoalComplete: false,
        now: noon,
      }).key,
    ).toBe("dashboard.spark.todayDone");
    expect(
      dashboardSparkKey({
        streakAtRisk: false,
        streakCount: 5,
        todayMinutes: 0,
        weeklyGoalComplete: false,
        now: noon,
      }),
    ).toEqual({ key: "dashboard.spark.streak", params: { count: 5 } });
  });

  it("falls back to time of day when there is no streak story", () => {
    expect(
      dashboardSparkKey({
        streakAtRisk: false,
        streakCount: 0,
        todayMinutes: 0,
        weeklyGoalComplete: false,
        now: noon,
      }).key,
    ).toBe("dashboard.spark.afternoon");
  });
});
