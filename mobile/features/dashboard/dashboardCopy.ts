export function dashboardGreetingKey(now = new Date()): 
  | "dashboard.greeting.night"
  | "dashboard.greeting.morning"
  | "dashboard.greeting.afternoon"
  | "dashboard.greeting.evening" {
  const hour = now.getHours();
  if (hour < 5 || hour >= 22) return "dashboard.greeting.night";
  if (hour < 12) return "dashboard.greeting.morning";
  if (hour < 17) return "dashboard.greeting.afternoon";
  return "dashboard.greeting.evening";
}

type SparkInput = {
  streakAtRisk: boolean;
  streakCount: number;
  todayMinutes: number;
  weeklyGoalComplete: boolean;
  now?: Date;
};

export function dashboardSparkKey({
  streakAtRisk,
  streakCount,
  todayMinutes,
  weeklyGoalComplete,
  now = new Date(),
}: SparkInput): { key: string; params?: { count: number } } {
  if (streakAtRisk) return { key: "dashboard.spark.atRisk" };
  if (weeklyGoalComplete) return { key: "dashboard.spark.goalDone" };
  if (todayMinutes > 0) return { key: "dashboard.spark.todayDone" };
  if (streakCount >= 3) return { key: "dashboard.spark.streak", params: { count: streakCount } };
  const hour = now.getHours();
  if (hour < 5 || hour >= 22) return { key: "dashboard.spark.night" };
  if (hour < 12) return { key: "dashboard.spark.morning" };
  if (hour < 17) return { key: "dashboard.spark.afternoon" };
  return { key: "dashboard.spark.evening" };
}
