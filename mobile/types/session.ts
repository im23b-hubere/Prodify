export const SESSION_TYPES = ["Beat Making", "Mixing", "Sound Design"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export type SessionDto = {
  id: number;
  user_id: number;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
  session_type: SessionType | string;
  notes: string | null;
  mood_level?: number | null;
  tags?: string[] | null;
  paused_duration_seconds?: number;
  pause_started_at?: string | null;
};

export type SessionStatsDto = {
  period: "week" | "month" | "all" | string;
  summary: {
    total_seconds: number;
    total_sessions: number;
    best_streak_days: number;
    avg_session_seconds: number;
    current_streak_days: number;
    hours_delta_vs_prior_period: number | null;
  };
  trend: Array<{
    label: string;
    sessions: number;
    seconds: number;
  }>;
  breakdown: Array<{
    session_type: SessionType | string;
    sessions: number;
    percent: number;
  }>;
  recent_sessions: SessionDto[];
  productivity_hint: string | null;
};
