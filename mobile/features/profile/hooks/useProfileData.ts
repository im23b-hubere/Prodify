import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiJson } from "../../../lib/client";
import { fetchProgression } from "../../../lib/progressionSync";
import { isScreenDataStale } from "../../../lib/screenDataStale";
import { tryParseHeatmapDays, tryParseSessionStatsDto } from "../../../lib/statsDto";
import type { ReliabilityScoreDto } from "../../../types/friends";
import type { ProgressionDto } from "../../../types/outcomes";
import type { SessionStatsDto } from "../../../types/session";
import type { StreakMilestonesDto } from "../../../types/streak";

type HeatmapDay = { date: string; seconds: number; intensity: number };

export function useProfileData(token?: string | null) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [milestones, setMilestones] = useState<StreakMilestonesDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reliability, setReliability] = useState<ReliabilityScoreDto | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const [progression, setProgression] = useState<ProgressionDto | null>(null);
  const requestSequence = useRef(0);
  const mounted = useRef(true);
  const lastFetchAt = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, []);

  const load = useCallback(
    async (options?: { force?: boolean }) => {
      if (!options?.force && !isScreenDataStale(lastFetchAt.current)) return;

      const sequence = ++requestSequence.current;
      if (!token) {
        if (mounted.current) setLoading(false);
        return;
      }
      if (mounted.current) {
        setLoading(true);
        setError(null);
      }

      try {
        const [statsResult, milestonesResult, reliabilityResult, heatmapResult, progressionResult] =
          await Promise.allSettled([
            apiJson<unknown>("/sessions/stats?period=all", { token }),
            apiJson<StreakMilestonesDto>("/streak/milestones", { token }),
            apiJson<ReliabilityScoreDto>("/users/me/reliability", { token }).catch(() => null),
            apiJson<unknown>("/stats/heatmap", { token }),
            fetchProgression(token),
          ]);
        if (!mounted.current || sequence !== requestSequence.current) return;

        setStats(
          statsResult.status === "fulfilled" ? tryParseSessionStatsDto(statsResult.value) : null,
        );
        setMilestones(milestonesResult.status === "fulfilled" ? milestonesResult.value : null);
        setReliability(reliabilityResult.status === "fulfilled" ? reliabilityResult.value : null);
        setHeatmapDays(
          heatmapResult.status === "fulfilled" ? tryParseHeatmapDays(heatmapResult.value) : [],
        );
        setProgression(progressionResult.status === "fulfilled" ? progressionResult.value : null);

        const errors: string[] = [];
        if (statsResult.status === "rejected") {
          errors.push(
            statsResult.reason instanceof Error
              ? statsResult.reason.message
              : t("profile.errorLoadProfile"),
          );
        }
        if (milestonesResult.status === "rejected") {
          errors.push(
            milestonesResult.reason instanceof Error
              ? milestonesResult.reason.message
              : t("profile.errorLoadMilestones"),
          );
        }
        setError(errors.length ? errors.join("\n") : null);
        lastFetchAt.current = Date.now();
      } catch (loadError) {
        if (!mounted.current || sequence !== requestSequence.current) return;
        setError(loadError instanceof Error ? loadError.message : t("profile.errorLoadProfile"));
        setStats(null);
        setMilestones(null);
        setReliability(null);
        setHeatmapDays([]);
        setProgression(null);
      } finally {
        if (!mounted.current || sequence !== requestSequence.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t, token],
  );

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    load({ force: true }).catch(() => undefined);
  }, [load]);

  return {
    stats,
    milestones,
    reliability,
    heatmapDays,
    progression,
    loading,
    refreshing,
    error,
    load,
    refresh,
  };
}
