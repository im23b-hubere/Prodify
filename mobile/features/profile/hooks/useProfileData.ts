import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiJson } from "../../../lib/client";
import { useAuthScopedReset } from "../../../lib/authScopedReset";
import { isScreenDataStale } from "../../../lib/screenDataStale";
import { tryParseHeatmapDays, tryParseSessionStatsDto } from "../../../lib/statsDto";
import type { SessionStatsDto } from "../../../types/session";
import type { StreakMilestonesDto } from "../../../types/streak";
import type { HeatmapDay } from "../../stats/types";
import { createClearedProfileState } from "./profileAuthReset";

async function loadProfileSnapshot(token: string) {
  return Promise.allSettled([
    apiJson<unknown>("/sessions/stats?period=all", { token }),
    apiJson<StreakMilestonesDto>("/streak/milestones", { token }),
    apiJson<unknown>("/stats/heatmap", { token }),
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
  const [stats, milestones, heatmap] = results;
  const errors = [
    rejectedMessage(stats, t("profile.errorLoadProfile")),
    rejectedMessage(milestones, t("profile.errorLoadMilestones")),
  ].filter((message): message is string => Boolean(message));
  return {
    stats: stats.status === "fulfilled" ? tryParseSessionStatsDto(stats.value) : null,
    milestones: milestones.status === "fulfilled" ? milestones.value : null,
    heatmapDays: heatmap.status === "fulfilled" ? tryParseHeatmapDays(heatmap.value) : [],
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

export function useProfileData(token?: string | null, userId?: number | null) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [milestones, setMilestones] = useState<StreakMilestonesDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const requestSequence = useRef(0);
  const mounted = useRef(true);
  const lastFetchAt = useRef(0);
  useRequestLifetime(mounted, requestSequence);

  const resetProfileAuthScope = useCallback(() => {
    requestSequence.current += 1;
    lastFetchAt.current = 0;
    const cleared = createClearedProfileState({
      token: token ?? null,
      userId,
    });
    setRefreshing(cleared.refreshing);
    setLoading(cleared.loading);
    setStats(cleared.stats);
    setMilestones(cleared.milestones);
    setHeatmapDays(cleared.heatmapDays);
    setError(cleared.error);
  }, [token, userId]);

  useAuthScopedReset(token ?? null, userId, resetProfileAuthScope);

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
        setHeatmapDays(snapshot.heatmapDays);
        setError(snapshot.error);
        lastFetchAt.current = Date.now();
      } catch (loadError) {
        if (!hasCurrentRequest(mounted, requestSequence, sequence)) return;
        setError(profileErrorMessage(loadError, t("profile.errorLoadProfile")));
        setStats(null);
        setMilestones(null);
        setHeatmapDays([]);
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
    heatmapDays,
    loading,
    refreshing,
    error,
    load,
    refresh,
  };
}
