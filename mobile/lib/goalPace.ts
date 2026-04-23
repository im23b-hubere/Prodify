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

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = mondayIndexedDay(d.getDay());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (day - 1));
  return d;
}

/**
 * For accounts created mid-week, scale the first week's target to remaining days.
 * Example: target 7, account created Wednesday -> ceil(7 * 5/7) = 5 for this week only.
 */
export function adjustedWeeklyTargetForSignupWeek({
  weeklyGoalTarget,
  accountCreatedAtIso,
  now = new Date(),
}: {
  weeklyGoalTarget: number | null;
  accountCreatedAtIso: string | null | undefined;
  now?: Date;
}): number | null {
  if (weeklyGoalTarget == null || weeklyGoalTarget <= 0) return null;
  if (!accountCreatedAtIso) return weeklyGoalTarget;
  const createdAt = new Date(accountCreatedAtIso);
  if (!Number.isFinite(createdAt.getTime())) return weeklyGoalTarget;

  const currentWeekStart = startOfWeekMonday(now);
  const createdWeekStart = startOfWeekMonday(createdAt);
  if (currentWeekStart.getTime() !== createdWeekStart.getTime()) {
    return weeklyGoalTarget;
  }

  const signupDay = mondayIndexedDay(createdAt.getDay());
  const remainingDaysIncludingSignup = Math.max(1, 8 - signupDay);
  return Math.max(1, Math.ceil((weeklyGoalTarget * remainingDaysIncludingSignup) / 7));
}
