import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TFunction } from "i18next";

import { WEEKLY_GOAL_CONFIGURED_KEY } from "../../../constants/storageKeys";
import { apiJson } from "../../../lib/client";
import { debugLog } from "../../../lib/debugLog";
import { fetchCurrentGoal, setWeeklyGoal as saveWeeklyGoalApi } from "../../../lib/goals";
import { fetchCommitment } from "../../../lib/social";
import { isScreenDataStale } from "../../../lib/screenDataStale";
import { fetchProgression, syncProgression } from "../../../lib/progressionSync";
import { tryParseGoalForecastDto } from "../../../lib/outcomesDto";
import {
  tryParseHeatmapDays,
  tryParsePersonalRecords,
  tryParseSessionStatsDto,
} from "../../../lib/statsDto";
import type { CommitmentDto } from "../../../types/friends";
import type { GoalCurrentDto } from "../../../types/goals";
import type { SessionStatsDto } from "../../../types/session";
import type { GoalForecastDto, ProgressionDto } from "../../../types/outcomes";
import type { HeatmapDay, PersonalRecord } from "../types";

type LoadOpts = { force?: boolean; forceProgressionSync?: boolean };

export function useStatsScreenData(token: string | null | undefined, periodParam: string, t: TFunction) {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<GoalForecastDto | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<GoalCurrentDto | null>(null);
  const [commitment, setCommitment] = useState<CommitmentDto | null>(null);
  const [goalConfigured, setGoalConfigured] = useState(false);
  const [weekBusy, setWeekBusy] = useState(false);
  const [progression, setProgression] = useState<ProgressionDto | null>(null);

  const loadSeq = useRef(0);
  const mounted = useRef(true);
  const lastStatsFetchRef = useRef<{ at: number; period: string } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadSeq.current += 1;
    };
  }, []);

  const loadStats = useCallback(
    async (opts: LoadOpts = {}) => {
      const force = Boolean(opts.force);
      const forceProgressionSync = Boolean(opts.forceProgressionSync);
      if (!token) return;

      const lastFetch = lastStatsFetchRef.current;
      if (
        !force &&
        !forceProgressionSync &&
        lastFetch &&
        lastFetch.period === periodParam &&
        !isScreenDataStale(lastFetch.at)
      ) {
        return;
      }

      const seq = ++loadSeq.current;
      if (mounted.current) setLoading(true);
      if (mounted.current) setError(null);
      try {
        const [rawStats, rawHm, rawRec] = await Promise.all([
          apiJson<unknown>(`/sessions/stats?period=${periodParam}`, { token }),
          apiJson<unknown>(`/stats/heatmap`, { token }),
          apiJson<unknown>(`/stats/records`, { token }),
        ]);
        if (!mounted.current || seq !== loadSeq.current) return;
        const parsed = tryParseSessionStatsDto(rawStats);
        if (!parsed) {
          debugLog("stats", "invalid_stats_payload", { period: periodParam });
          if (mounted.current) {
            setStats(null);
            setHeatmapDays([]);
            setRecords([]);
            setProgression(null);
            setError(t("stats.invalidResponse"));
          }
          return;
        }
        if (mounted.current) {
          setStats(parsed);
          setHeatmapDays(tryParseHeatmapDays(rawHm));
          setRecords(tryParsePersonalRecords(rawRec));
        }
        if (mounted.current && seq === loadSeq.current) setLoading(false);

        const [progressionRes, goalRes, commitmentRes, configuredRes, forecastRes] =
          await Promise.allSettled([
            forceProgressionSync
              ? syncProgression(token, { force: true })
              : fetchProgression(token),
            fetchCurrentGoal(token),
            fetchCommitment(token),
            AsyncStorage.getItem(WEEKLY_GOAL_CONFIGURED_KEY),
            apiJson<unknown>("/outcomes/goal-forecast/current", { token }),
          ]);
        if (!mounted.current || seq !== loadSeq.current) return;

        const progressionRaw = progressionRes.status === "fulfilled" ? progressionRes.value : null;
        const goalRaw = goalRes.status === "fulfilled" ? goalRes.value : null;
        const commitmentRaw = commitmentRes.status === "fulfilled" ? commitmentRes.value : null;
        const configuredRaw = configuredRes.status === "fulfilled" ? configuredRes.value : null;
        const forecastRaw = forecastRes.status === "fulfilled" ? forecastRes.value : null;

        if (mounted.current && seq === loadSeq.current) {
          setForecast(forecastRaw ? tryParseGoalForecastDto(forecastRaw) : null);
        }
        setWeeklyGoal(goalRaw);
        setCommitment(commitmentRaw);
        const hasConfiguredFlag = configuredRaw === "1";
        const hasWeekActivity = (goalRaw?.current_sessions ?? 0) > 0;
        const isConfigured = hasConfiguredFlag || hasWeekActivity;
        setGoalConfigured(isConfigured);
        if (isConfigured && !hasConfiguredFlag) {
          void AsyncStorage.setItem(WEEKLY_GOAL_CONFIGURED_KEY, "1");
        }
        setProgression(progressionRaw);
        lastStatsFetchRef.current = { at: Date.now(), period: periodParam };
      } catch (e) {
        if (!mounted.current || seq !== loadSeq.current) return;
        const msg = e instanceof Error ? e.message : t("stats.loadFailed");
        debugLog("stats", "stats_fetch_failed", { period: periodParam, message: msg });
        if (mounted.current) setError(msg);
      } finally {
        if (!mounted.current || seq !== loadSeq.current) return;
        setLoading(false);
      }
    },
    [periodParam, token, t],
  );

  const onRefresh = useCallback(
    async (setExternalError?: (msg: string) => void) => {
      if (mounted.current) setRefreshing(true);
      await loadStats({ force: true, forceProgressionSync: true }).catch((e) => {
        const msg = e instanceof Error ? e.message : t("stats.loadFailed");
        if (setExternalError) setExternalError(msg);
        else if (mounted.current) setError(msg);
      });
      if (mounted.current) setRefreshing(false);
    },
    [loadStats, t],
  );

  const saveWeeklyGoal = useCallback(
    async (target: number, shareWithFriends: boolean) => {
      if (!token) return;
      setWeekBusy(true);
      try {
        const updated = await saveWeeklyGoalApi(token, target);
        setWeeklyGoal(updated);
        await AsyncStorage.setItem(WEEKLY_GOAL_CONFIGURED_KEY, "1").catch(() => undefined);
        setGoalConfigured(true);
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
          const nextCommitment = await fetchCommitment(token);
          setCommitment(nextCommitment);
        }
        const nextForecastRaw = await apiJson<unknown>("/outcomes/goal-forecast/current", {
          token,
        }).catch(() => null);
        setForecast(nextForecastRaw ? tryParseGoalForecastDto(nextForecastRaw) : null);
      } finally {
        setWeekBusy(false);
      }
    },
    [token],
  );

  return {
    refreshing,
    loading,
    stats,
    heatmapDays,
    records,
    error,
    setError,
    forecast,
    weeklyGoal,
    commitment,
    goalConfigured,
    weekBusy,
    progression,
    loadStats,
    onRefresh,
    saveWeeklyGoal,
  };
}
