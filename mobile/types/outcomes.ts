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
