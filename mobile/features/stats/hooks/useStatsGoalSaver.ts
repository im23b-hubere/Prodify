import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, type Dispatch, type SetStateAction } from "react";

import { WEEKLY_GOAL_CONFIGURED_KEY } from "../../../constants/storageKeys";
import { apiJson } from "../../../lib/client";
import { setWeeklyGoal } from "../../../lib/goals";
import { tryParseGoalForecastDto } from "../../../lib/outcomesDto";
import { fetchCommitment } from "../../../lib/social";
import type { StatsScreenDataState } from "../statsScreenDataState";

export function useStatsGoalSaver(
  token: string | null | undefined,
  setState: Dispatch<SetStateAction<StatsScreenDataState>>,
) {
  return useCallback(
    async (target: number, shareWithFriends: boolean) => {
      if (!token) return;
      setState((current) => ({ ...current, weekBusy: true }));
      try {
        const weeklyGoal = await setWeeklyGoal(token, target);
        await AsyncStorage.setItem(WEEKLY_GOAL_CONFIGURED_KEY, "1").catch(() => undefined);
        let commitment: StatsScreenDataState["commitment"] | undefined;
        if (shareWithFriends) {
          await apiJson("/social/commitment", {
            token,
            method: "POST",
            body: {
              target_sessions: target,
              visibility: "friends",
              commitment_key: "sessions",
              period_days: 7,
              witness_user_ids: [],
            },
          });
          commitment = await fetchCommitment(token);
        }
        const rawForecast = await apiJson<unknown>("/outcomes/goal-forecast/current", {
          token,
        }).catch(() => null);
        setState((current) => ({
          ...current,
          weeklyGoal,
          goalConfigured: true,
          ...(commitment !== undefined ? { commitment } : {}),
          forecast: rawForecast ? tryParseGoalForecastDto(rawForecast) : null,
        }));
      } finally {
        setState((current) => ({ ...current, weekBusy: false }));
      }
    },
    [setState, token],
  );
}
