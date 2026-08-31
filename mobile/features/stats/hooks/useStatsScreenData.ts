import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";

import { INITIAL_STATS_SCREEN_DATA } from "../statsScreenDataState";
import { createClearedStatsScreenState, useStatsAuthReset } from "./statsAuthReset";
import { useStatsGoalSaver } from "./useStatsGoalSaver";
import { useStatsLoader } from "./useStatsLoader";

export function useStatsScreenData(
  token: string | null | undefined,
  userId: number | null | undefined,
  periodParam: string,
  t: TFunction,
) {
  const [state, setState] = useState(INITIAL_STATS_SCREEN_DATA);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { loadStats, invalidateLoader } = useStatsLoader(token, periodParam, t, setState);

  const resetStatsAuthScope = useCallback(() => {
    invalidateLoader();
    setState(createClearedStatsScreenState({ token: token ?? null, userId }));
  }, [invalidateLoader, token, userId]);

  useStatsAuthReset(token ?? null, userId, resetStatsAuthScope);
  const saveWeeklyGoal = useStatsGoalSaver(token, setState);
  const onRefresh = useCallback(
    async (setExternalError?: (message: string) => void) => {
      setState((current) => ({ ...current, refreshing: true }));
      await loadStats({ force: true, forceProgressionSync: true }).catch((cause) => {
        const message = cause instanceof Error ? cause.message : t("stats.loadFailed");
        if (setExternalError) setExternalError(message);
        else setState((current) => ({ ...current, error: message }));
      });
      if (mounted.current) setState((current) => ({ ...current, refreshing: false }));
    },
    [loadStats, t],
  );
  return {
    ...state,
    setError: (error: string | null) => setState((current) => ({ ...current, error })),
    loadStats,
    onRefresh,
    saveWeeklyGoal,
  };
}
