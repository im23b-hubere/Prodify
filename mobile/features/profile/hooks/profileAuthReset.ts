import type { SessionStatsDto } from "../../../types/session";
import type { StreakMilestonesDto } from "../../../types/streak";
import type { HeatmapDay } from "../../stats/types";

export type ProfileDataState = {
  refreshing: boolean;
  loading: boolean;
  stats: SessionStatsDto | null;
  milestones: StreakMilestonesDto | null;
  heatmapDays: HeatmapDay[];
  error: string | null;
};

type AuthScopeOptions = {
  token: string | null;
  userId: number | null | undefined;
};

/** Clears all account-owned Profile state without substituting fake metric values. */
export function createClearedProfileState({
  token,
  userId,
}: AuthScopeOptions): ProfileDataState {
  return {
    refreshing: false,
    loading: Boolean(token && userId != null),
    stats: null,
    milestones: null,
    heatmapDays: [],
    error: null,
  };
}
