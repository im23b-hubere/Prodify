import { apiJson } from "./client";
import type { GoalCurrentDto } from "../types/goals";

export function tryParseGoalCurrentDto(raw: unknown): GoalCurrentDto | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (
    typeof v.goal_type !== "string" ||
    typeof v.target_value !== "number" ||
    typeof v.week_start !== "string" ||
    typeof v.current_sessions !== "number" ||
    typeof v.progress_percent !== "number"
  ) {
    return null;
  }
  return {
    goal_type: v.goal_type,
    target_value: v.target_value,
    week_start: v.week_start,
    current_sessions: v.current_sessions,
    progress_percent: v.progress_percent,
  };
}

export async function fetchCurrentGoal(token: string): Promise<GoalCurrentDto | null> {
  const raw = await apiJson<unknown>("/goals/current", { token });
  return tryParseGoalCurrentDto(raw);
}

export async function setWeeklyGoal(
  token: string,
  targetValue: number,
): Promise<GoalCurrentDto | null> {
  const raw = await apiJson<unknown>("/goals/set", {
    token,
    method: "POST",
    body: { goal_type: "weekly_sessions", target_value: targetValue },
  });
  return tryParseGoalCurrentDto(raw);
}
