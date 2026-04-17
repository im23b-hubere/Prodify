export const SESSION_TYPES = ["Beat Making", "Mixing", "Sound Design"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export type SessionDto = {
  id: number;
  user_id: number;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
  session_type: SessionType;
  notes: string | null;
};

export type SessionStatsDto = {
  period: "week" | "month" | "all" | string;
  summary: {
    total_seconds: number;
    total_sessions: number;
    best_streak_days: number;
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
};
