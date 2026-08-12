import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";

import { apiJson } from "../../../lib/client";
import type { StreakOverviewDto, StreakRunDto } from "../../../types/streak";

export const HISTORY_FETCH_LIMIT = 120;

export function useStreakHistory(token: string | null, fallbackError: string) {
  const [runs, setRuns] = useState<StreakRunDto[]>([]);
  const [currentStreak, setCurrentStreak] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      clearHistory(setRuns, setCurrentStreak, setError);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError(null);
      const [historyResult, overviewResult] = await Promise.allSettled([
        apiJson<StreakRunDto[]>(`/streak/history?limit=${HISTORY_FETCH_LIMIT}`, { token }),
        apiJson<StreakOverviewDto>("/streak/overview", { token }),
      ]);
      setCurrentStreak(readCurrentStreak(overviewResult));
      if (historyResult.status === "rejected") throw historyResult.reason;
      setRuns(Array.isArray(historyResult.value) ? historyResult.value : []);
    } catch (caught) {
      clearHistory(setRuns, setCurrentStreak);
      setError(caught instanceof Error ? caught.message : fallbackError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fallbackError, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(() => {
    if (!token) return;
    setRefreshing(true);
    void load();
  }, [load, token]);

  const retry = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { runs, currentStreak, loading, refreshing, error, refresh, retry };
}

function readCurrentStreak(result: PromiseSettledResult<StreakOverviewDto>): number | null {
  if (result.status !== "fulfilled") return null;
  return typeof result.value.current_streak === "number" ? result.value.current_streak : null;
}

function clearHistory(
  setRuns: (runs: StreakRunDto[]) => void,
  setCurrentStreak: (value: number | null) => void,
  setError?: (value: string | null) => void,
) {
  setRuns([]);
  setCurrentStreak(null);
  setError?.(null);
}
