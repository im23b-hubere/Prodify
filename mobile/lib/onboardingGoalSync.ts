import AsyncStorage from "@react-native-async-storage/async-storage";

import { PENDING_WEEKLY_GOAL_KEY } from "../constants/storageKeys";
import { apiJson } from "./client";

function parsePendingGoal(raw: string | null): number | null {
  const parsed = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 50) return null;
  return parsed;
}

export async function savePendingWeeklyGoal(goal: number): Promise<void> {
  await AsyncStorage.setItem(PENDING_WEEKLY_GOAL_KEY, String(goal));
}

export async function syncPendingWeeklyGoal(accessToken: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PENDING_WEEKLY_GOAL_KEY);
  const goal = parsePendingGoal(raw);
  if (goal == null) return false;
  await apiJson("/goals/set", {
    token: accessToken,
    method: "POST",
    body: { goal_type: "weekly_sessions", target_value: goal },
  });
  await AsyncStorage.removeItem(PENDING_WEEKLY_GOAL_KEY);
  return true;
}

