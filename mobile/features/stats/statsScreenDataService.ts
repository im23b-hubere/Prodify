import AsyncStorage from "@react-native-async-storage/async-storage";

import { WEEKLY_GOAL_CONFIGURED_KEY } from "../../constants/storageKeys";
import { apiJson } from "../../lib/client";
import { fetchCurrentGoal } from "../../lib/goals";
import { tryParseGoalForecastDto } from "../../lib/outcomesDto";
import { fetchProgression, syncProgression } from "../../lib/progressionSync";
import { fetchCommitment } from "../../lib/social";
import {
  tryParseHeatmapDays,
  tryParsePersonalRecords,
  tryParseSessionStatsDto,
} from "../../lib/statsDto";

export async function fetchPrimaryStats(token: string, period: string) {
  const [rawStats, rawHeatmap, rawRecords] = await Promise.all([
    apiJson<unknown>(`/sessions/stats?period=${period}`, { token }),
    apiJson<unknown>("/stats/heatmap", { token }),
    apiJson<unknown>("/stats/records", { token }),
  ]);
  return {
    stats: tryParseSessionStatsDto(rawStats),
    heatmapDays: tryParseHeatmapDays(rawHeatmap),
    records: tryParsePersonalRecords(rawRecords),
  };
}

export async function fetchSupplementalStats(token: string, forceProgressionSync: boolean) {
  const [progression, goal, commitment, configured, forecast] = await Promise.allSettled([
    forceProgressionSync ? syncProgression(token, { force: true }) : fetchProgression(token),
    fetchCurrentGoal(token),
    fetchCommitment(token),
    AsyncStorage.getItem(WEEKLY_GOAL_CONFIGURED_KEY),
    apiJson<unknown>("/outcomes/goal-forecast/current", { token }),
  ]);
  const weeklyGoal = goal.status === "fulfilled" ? goal.value : null;
  const configuredFlag = configured.status === "fulfilled" ? configured.value : null;
  const goalConfigured = configuredFlag === "1" || (weeklyGoal?.current_sessions ?? 0) > 0;
  if (goalConfigured && configuredFlag !== "1") {
    void AsyncStorage.setItem(WEEKLY_GOAL_CONFIGURED_KEY, "1");
  }
  return {
    progression: progression.status === "fulfilled" ? progression.value : null,
    weeklyGoal,
    commitment: commitment.status === "fulfilled" ? commitment.value : null,
    goalConfigured,
    forecast:
      forecast.status === "fulfilled" && forecast.value
        ? tryParseGoalForecastDto(forecast.value)
        : null,
  };
}
