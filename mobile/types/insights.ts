export type SessionDetailInsightsDto = {
  impact_lines: string[];
  focus_score: number;
  focus_label: string;
  focus_percentile: number | null;
  focus_user_average?: number | null;
  active_seconds: number;
  paused_seconds: number;
  effective_rate_percent: number;
  timeline: { kind: string; seconds: number }[];
  productivity_insights: string[];
  related_sessions: {
    id: number;
    session_type: string;
    duration_seconds: number | null;
    started_at: string;
  }[];
};
