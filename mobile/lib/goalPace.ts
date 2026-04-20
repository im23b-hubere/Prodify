export type GoalTrackStatus = "off_track" | "on_track" | "ahead";

export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function mondayIndexedDay(day: number): number {
  return day === 0 ? 7 : day;
}

export function expectedWeeklySessionsByToday(target: number, date = new Date()): number {
  const dayOfWeek = mondayIndexedDay(date.getDay());
  return Math.ceil((target * dayOfWeek) / 7);
}

export function classifyGoalTrackStatus({
  weeklyGoalTarget,
  weekSessionsCount,
  expectedByNow,
}: {
  weeklyGoalTarget: number;
  weekSessionsCount: number;
  expectedByNow: number;
}): GoalTrackStatus {
  const remaining = Math.max(0, weeklyGoalTarget - weekSessionsCount);
  if (remaining <= 0) return "ahead";
  if (weekSessionsCount < expectedByNow) return "off_track";
  return "on_track";
}

export function weeklyGoalProgressPercent({
  weeklyGoalTarget,
  weekSessionsCount,
}: {
  weeklyGoalTarget: number;
  weekSessionsCount: number;
}): number {
  return clampInt((weekSessionsCount / weeklyGoalTarget) * 100, 0, 999);
}
