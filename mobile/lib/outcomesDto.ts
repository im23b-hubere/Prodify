import type {
  EntitlementDto,
  GoalForecastDto,
  OutputMetricsDto,
  ProgressionDto,
  WeeklyReviewDto,
} from "../types/outcomes";

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function tryParseEntitlementDto(raw: unknown): EntitlementDto | null {
  if (!isObj(raw)) return null;
  if (raw.entitlement !== "free" && raw.entitlement !== "premium") return null;
  return {
    provider: typeof raw.provider === "string" ? raw.provider : "revenuecat",
    entitlement: raw.entitlement,
    trial_active: Boolean(raw.trial_active),
    expires_at: typeof raw.expires_at === "string" ? raw.expires_at : null,
  };
}

export function tryParseWeeklyReviewDto(raw: unknown): WeeklyReviewDto | null {
  if (!isObj(raw)) return null;
  if (typeof raw.week_start !== "string" || typeof raw.week_end !== "string") return null;
  return {
    week_start: raw.week_start,
    week_end: raw.week_end,
    total_sessions: Number(raw.total_sessions ?? 0),
    total_seconds: Number(raw.total_seconds ?? 0),
    insights: Array.isArray(raw.insights) ? raw.insights.map(String) : [],
    blockers: Array.isArray(raw.blockers) ? raw.blockers.map(String) : [],
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.map(String) : [],
    ai_feedback: typeof raw.ai_feedback === "string" ? raw.ai_feedback : "",
    share_image_url: typeof raw.share_image_url === "string" ? raw.share_image_url : null,
  };
}

export function tryParseGoalForecastDto(raw: unknown): GoalForecastDto | null {
  if (!isObj(raw)) return null;
  const risk = raw.risk_level;
  if (risk !== "on_track" && risk !== "at_risk" && risk !== "off_track") return null;
  return {
    week_start: typeof raw.week_start === "string" ? raw.week_start : "",
    target_sessions: Number(raw.target_sessions ?? 0),
    completed_sessions: Number(raw.completed_sessions ?? 0),
    remaining_sessions: Number(raw.remaining_sessions ?? 0),
    days_left: Number(raw.days_left ?? 0),
    required_sessions_per_day: Number(raw.required_sessions_per_day ?? 0),
    risk_level: risk,
    warning_message: typeof raw.warning_message === "string" ? raw.warning_message : "",
  };
}

export function tryParseProgressionDto(raw: unknown): ProgressionDto | null {
  if (!isObj(raw)) return null;
  return {
    xp_total: Number(raw.xp_total ?? 0),
    current_level: Number(raw.current_level ?? 1),
    xp_to_next_level: Number(raw.xp_to_next_level ?? 50),
    progress_percent: Number(raw.progress_percent ?? 0),
    decay_grace_days: Number(raw.decay_grace_days ?? 2),
    decay_xp_per_day: Number(raw.decay_xp_per_day ?? 12),
  };
}

export function tryParseOutputMetricsDto(raw: unknown): OutputMetricsDto | null {
  if (!isObj(raw)) return null;
  const trend = raw.productivity_trend;
  if (trend !== "up" && trend !== "down" && trend !== "stable") return null;
  return {
    tracks_finished_30d: Number(raw.tracks_finished_30d ?? 0),
    avg_completion_time_days: Number(raw.avg_completion_time_days ?? 0),
    release_consistency: Number(raw.release_consistency ?? 0),
    productivity_trend: trend,
    vs_previous_month: Number(raw.vs_previous_month ?? 0),
    days_using: Number(raw.days_using ?? 0),
    completed_tracks: Number(raw.completed_tracks ?? 0),
    consistency_improvement: Number(raw.consistency_improvement ?? 0),
    output_increase: Number(raw.output_increase ?? 0),
    baseline_tracks_30d: Number(raw.baseline_tracks_30d ?? 0),
  };
}
