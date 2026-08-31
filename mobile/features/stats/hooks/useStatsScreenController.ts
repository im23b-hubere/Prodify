import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { progressionOverviewHref } from "../../../lib/progressionNavigation";
import { useStatsScreenData } from "./useStatsScreenData";
import { useStatsScreenLifecycle } from "./useStatsScreenLifecycle";
import { useStatsFilters, useStatsPresentation } from "./useStatsPresentation";

export function useStatsScreenController() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const rawFocus = useLocalSearchParams<{ focus?: string | string[] }>().focus;
  const focusParam = Array.isArray(rawFocus) ? rawFocus[0] : rawFocus;
  const [filterIdx, setFilterIdx] = useState(0);
  const { filters, filter, periodParam } = useStatsFilters(t, filterIdx);
  const data = useStatsScreenData(token, user?.id, periodParam, t);
  const presentation = useStatsPresentation(data.stats, data.records, filter.period, t);
  const showInitialLoading = data.loading && !data.refreshing && !data.stats && !data.error;
  const lifecycle = useStatsScreenLifecycle({
    token,
    focusParam,
    periodParam,
    showInitialLoading,
    loadStats: data.loadStats,
    onFocusHandled: () => router.setParams({ focus: undefined } as never),
  });

  const selectFilter = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setFilterIdx(index);
  }, []);
  const refresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    void data.onRefresh();
  }, [data]);

  return {
    t,
    token,
    filterIdx,
    filters,
    filter,
    ...data,
    ...presentation,
    ...lifecycle,
    showInitialLoading,
    showInlineLoading: data.loading && !data.refreshing && !!data.stats,
    selectFilter,
    refresh,
    startSession: () => router.push("/session/setup"),
    openWeeklyRecap: () => router.push("/weekly-recap"),
    openProgression: () => router.push(progressionOverviewHref("stats")),
  };
}

export type StatsScreenController = ReturnType<typeof useStatsScreenController>;
