import { apiJson } from "../../lib/client";
import { fetchCurrentGoal } from "../../lib/goals";
import { tryParseGoalForecastDto } from "../../lib/outcomesDto";
import { fetchCommitment } from "../../lib/social";
import {
  tryParseHeatmapDays,
  tryParsePersonalRecords,
  tryParseSessionStatsDto,
} from "../../lib/statsDto";
import type { HeatmapDay, PersonalRecord } from "./types";
import type { SessionStatsDto } from "../../types/session";

export type PrimaryStatsResult = {
  stats: SessionStatsDto | null;
  /** undefined means the heatmap request failed — caller should preserve previous days */
  heatmapDays: HeatmapDay[] | undefined;
  /** undefined means the records request failed — caller should preserve previous records */
  records: PersonalRecord[] | undefined;
};

export async function fetchPrimaryStats(token: string, period: string): Promise<PrimaryStatsResult> {
  const [statsResult, heatmapResult, recordsResult] = await Promise.allSettled([
    apiJson<unknown>(`/sessions/stats?period=${period}`, { token }),
    apiJson<unknown>("/stats/heatmap", { token }),
    apiJson<unknown>("/stats/records", { token }),
  ]);

  if (statsResult.status === "rejected") {
    throw statsResult.reason instanceof Error
      ? statsResult.reason
      : new Error(String(statsResult.reason));
  }

  return {
    stats: tryParseSessionStatsDto(statsResult.value),
    heatmapDays:
      heatmapResult.status === "fulfilled"
        ? tryParseHeatmapDays(heatmapResult.value)
        : undefined,
    records:
      recordsResult.status === "fulfilled"
        ? tryParsePersonalRecords(recordsResult.value)
        : undefined,
  };
}

export async function fetchSupplementalStats(token: string) {
  const [goal, commitment, forecast] = await Promise.allSettled([
    fetchCurrentGoal(token),
    fetchCommitment(token),
    apiJson<unknown>("/outcomes/goal-forecast/current", { token }),
  ]);
  const weeklyGoal = goal.status === "fulfilled" ? goal.value : null;
  const goalConfigured = weeklyGoal?.configured === true;
  return {
    weeklyGoal,
    commitment: commitment.status === "fulfilled" ? commitment.value : null,
    goalConfigured,
    forecast:
      forecast.status === "fulfilled" && forecast.value
        ? tryParseGoalForecastDto(forecast.value)
        : null,
  };
}
