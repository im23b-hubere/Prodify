import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { debugLog } from "../../../lib/debugLog";
import { isScreenDataStale } from "../../../lib/screenDataStale";
import { fetchPrimaryStats, fetchSupplementalStats } from "../statsScreenDataService";
import type { StatsScreenDataState } from "../statsScreenDataState";

export type StatsLoadOptions = { force?: boolean; forceProgressionSync?: boolean };

export function useStatsLoader(
  token: string | null | undefined,
  period: string,
  t: TFunction,
  setState: Dispatch<SetStateAction<StatsScreenDataState>>,
) {
  const sequence = useRef(0);
  const mounted = useRef(true);
  const lastFetch = useRef<{ at: number; period: string } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
    };
  }, []);
  const invalidateLoader = useCallback(() => {
    sequence.current += 1;
    lastFetch.current = null;
  }, []);

  const loadStats = useCallback(
    async (options: StatsLoadOptions = {}) => {
      const forceProgression = Boolean(options.forceProgressionSync);
      if (!token) return;
      if (
        !options.force &&
        !forceProgression &&
        lastFetch.current?.period === period &&
        !isScreenDataStale(lastFetch.current.at)
      )
        return;
      const request = ++sequence.current;
      setState((current) => ({ ...current, loading: true, error: null, progressionSettled: false }));
      try {
        const primary = await fetchPrimaryStats(token, period);
        if (!mounted.current || request !== sequence.current) return;
        if (!primary.stats) {
          debugLog("stats", "invalid_stats_payload", { period });
          setState((current) => {
            // Refresh with invalid payload: keep last-known-good KPIs.
            if (current.stats) {
              return {
                ...current,
                error: t("stats.invalidResponse"),
                progressionSettled: true,
              };
            }
            return {
              ...current,
              stats: null,
              heatmapDays: [],
              records: [],
              progression: null,
              progressionSettled: true,
              error: t("stats.invalidResponse"),
            };
          });
          return;
        }
        setState((current) => ({
          ...current,
          stats: primary.stats,
          heatmapDays:
            primary.heatmapDays !== undefined ? primary.heatmapDays : current.heatmapDays,
          records: primary.records !== undefined ? primary.records : current.records,
          loading: false,
        }));
        const supplemental = await fetchSupplementalStats(token, forceProgression);
        if (!mounted.current || request !== sequence.current) return;
        setState((current) => ({ ...current, ...supplemental, progressionSettled: true }));
        lastFetch.current = { at: Date.now(), period };
      } catch (cause) {
        if (!mounted.current || request !== sequence.current) return;
        const message = cause instanceof Error ? cause.message : t("stats.loadFailed");
        debugLog("stats", "stats_fetch_failed", { period, message });
        // Preserve last-known-good snapshot on transient failure.
        // Auth reset clears via createClearedStatsScreenState separately.
        setState((current) => ({ ...current, error: message }));
      } finally {
        if (mounted.current && request === sequence.current) {
          setState((current) => ({ ...current, loading: false, progressionSettled: true }));
        }
      }
    },
    [period, setState, t, token],
  );

  return { loadStats, invalidateLoader };
}
