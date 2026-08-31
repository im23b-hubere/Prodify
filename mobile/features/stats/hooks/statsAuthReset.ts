import { useAuthScopedReset } from "../../../lib/authScopedReset";
import type { StatsScreenDataState } from "../statsScreenDataState";

export { useAuthScopedReset as useStatsAuthReset };

type AuthScopeOptions = {
  token: string | null;
  userId: number | null | undefined;
};

/** Clears all account-owned Stats state without substituting fake KPI values. */
export function createClearedStatsScreenState({
  token,
  userId,
}: AuthScopeOptions): StatsScreenDataState {
  return {
    refreshing: false,
    loading: Boolean(token && userId != null),
    stats: null,
    heatmapDays: [],
    records: [],
    error: null,
    forecast: null,
    weeklyGoal: null,
    commitment: null,
    goalConfigured: false,
    weekBusy: false,
    progression: null,
    progressionSettled: false,
  };
}
