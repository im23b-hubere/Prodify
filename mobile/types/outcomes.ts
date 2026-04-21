export type EntitlementDto = {
  provider: string;
  entitlement: "free" | "premium";
  trial_active: boolean;
  expires_at: string | null;
};

export type WeeklyReviewDto = {
  week_start: string;
  week_end: string;
  total_sessions: number;
  total_seconds: number;
  insights: string[];
  blockers: string[];
  suggestions: string[];
  ai_feedback: string;
  share_image_url: string | null;
};

export type GoalForecastDto = {
  week_start: string;
  target_sessions: number;
  completed_sessions: number;
  remaining_sessions: number;
  days_left: number;
  required_sessions_per_day: number;
  risk_level: "on_track" | "at_risk" | "off_track";
  warning_message: string;
};

export type CoachDebriefDto = {
  session_id: number;
  went_well: string[];
  didnt_go_well: string[];
  next_steps: string[];
  tone: string;
};

export type ProgressionDto = {
  xp_total: number;
  current_level: number;
  xp_to_next_level: number;
  progress_percent: number;
};

export type OutputMetricsDto = {
  tracks_finished_30d: number;
  avg_completion_time_days: number;
  release_consistency: number;
  productivity_trend: "up" | "down" | "stable";
  vs_previous_month: number;
  days_using: number;
  completed_tracks: number;
  consistency_improvement: number;
  output_increase: number;
  baseline_tracks_30d: number;
};
