import type { CommitmentDto } from "../../types/friends";
import type { GoalCurrentDto } from "../../types/goals";
import type { GoalForecastDto, ProgressionDto } from "../../types/outcomes";
import type { SessionStatsDto } from "../../types/session";
import type { HeatmapDay, PersonalRecord } from "./types";

export type StatsScreenDataState = {
  refreshing: boolean;
  loading: boolean;
  stats: SessionStatsDto | null;
  heatmapDays: HeatmapDay[];
  records: PersonalRecord[];
  error: string | null;
  forecast: GoalForecastDto | null;
  weeklyGoal: GoalCurrentDto | null;
  commitment: CommitmentDto | null;
  goalConfigured: boolean;
  weekBusy: boolean;
  progression: ProgressionDto | null;
  progressionSettled: boolean;
};

export const INITIAL_STATS_SCREEN_DATA: StatsScreenDataState = {
  refreshing: false,
  loading: true,
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
