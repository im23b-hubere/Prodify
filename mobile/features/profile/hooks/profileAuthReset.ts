import { useAuthScopedReset } from "../../../lib/authScopedReset";
import type { ReliabilityScoreDto } from "../../../types/friends";
import type { ProgressionDto } from "../../../types/outcomes";
import type { SessionStatsDto } from "../../../types/session";
import type { StreakMilestonesDto } from "../../../types/streak";

export { useAuthScopedReset as useProfileAuthReset };

type HeatmapDay = { date: string; seconds: number; intensity: number };

export type ProfileDataState = {
  refreshing: boolean;
  loading: boolean;
  stats: SessionStatsDto | null;
  milestones: StreakMilestonesDto | null;
  reliability: ReliabilityScoreDto | null;
  heatmapDays: HeatmapDay[];
  progression: ProgressionDto | null;
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
    reliability: null,
    heatmapDays: [],
    progression: null,
    error: null,
  };
}
