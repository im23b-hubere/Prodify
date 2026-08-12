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

async function loadProfileSnapshot(token: string) {
  return Promise.allSettled([
    apiJson<unknown>("/sessions/stats?period=all", { token }),
    apiJson<StreakMilestonesDto>("/streak/milestones", { token }),
    apiJson<ReliabilityScoreDto>("/users/me/reliability", { token }).catch(() => null),
    apiJson<unknown>("/stats/heatmap", { token }),
    fetchProgression(token),
  ]);
}

function rejectedMessage(result: PromiseSettledResult<unknown>, fallback: string): string | null {
  if (result.status !== "rejected") return null;
  return result.reason instanceof Error ? result.reason.message : fallback;
}

function parseProfileSnapshot(
  results: Awaited<ReturnType<typeof loadProfileSnapshot>>,
  t: ReturnType<typeof useTranslation>["t"],
) {
  const [stats, milestones, reliability, heatmap, progression] = results;
  const errors = [
    rejectedMessage(stats, t("profile.errorLoadProfile")),
    rejectedMessage(milestones, t("profile.errorLoadMilestones")),
  ].filter((message): message is string => Boolean(message));
  return {
    stats: stats.status === "fulfilled" ? tryParseSessionStatsDto(stats.value) : null,
    milestones: milestones.status === "fulfilled" ? milestones.value : null,
    reliability: reliability.status === "fulfilled" ? reliability.value : null,
    heatmapDays: heatmap.status === "fulfilled" ? tryParseHeatmapDays(heatmap.value) : [],
    progression: progression.status === "fulfilled" ? progression.value : null,
    error: errors.length ? errors.join("\n") : null,
  };
}

function useRequestLifetime(mounted: { current: boolean }, requestSequence: { current: number }) {
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, [mounted, requestSequence]);
}

function hasCurrentRequest(
  mounted: { current: boolean },
  requestSequence: { current: number },
  sequence: number,
): boolean {
  return mounted.current && sequence === requestSequence.current;
}

function shouldSkipLoad(force: boolean | undefined, lastFetch: number): boolean {
  return !force && !isScreenDataStale(lastFetch);
}

function profileErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

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
  useRequestLifetime(mounted, requestSequence);

  const load = useCallback(
    async (options?: { force?: boolean }) => {
      if (shouldSkipLoad(options?.force, lastFetchAt.current)) return;

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
        const snapshot = parseProfileSnapshot(await loadProfileSnapshot(token), t);
        if (!hasCurrentRequest(mounted, requestSequence, sequence)) return;
        setStats(snapshot.stats);
        setMilestones(snapshot.milestones);
        setReliability(snapshot.reliability);
        setHeatmapDays(snapshot.heatmapDays);
        setProgression(snapshot.progression);
        setError(snapshot.error);
        lastFetchAt.current = Date.now();
      } catch (loadError) {
        if (!hasCurrentRequest(mounted, requestSequence, sequence)) return;
        setError(profileErrorMessage(loadError, t("profile.errorLoadProfile")));
        setStats(null);
        setMilestones(null);
        setReliability(null);
        setHeatmapDays([]);
        setProgression(null);
      } finally {
        if (!hasCurrentRequest(mounted, requestSequence, sequence)) return;
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
