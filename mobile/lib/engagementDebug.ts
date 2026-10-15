import { apiJson } from "./client";

/** Development-only dry run of the engagement engine (`GET /engagement/debug`). */
export type EngagementDebugCandidate = {
  type: string;
  category: string;
  title: string;
  body: string;
  reason: string;
  total: number;
  priority: string;
  parts: Record<string, number>;
  verdict: string;
  is_eligible: boolean;
};

export type EngagementDebug = {
  evaluated_at: string;
  profile: {
    stage: number;
    total_sessions: number;
    avg_sessions_per_week: number;
    avg_session_duration_minutes: number;
    sessions_last_7_days: number;
    sessions_previous_7_days: number;
    days_since_last_session: number | null;
    preferred_hours: number[];
  };
  production_window: {
    weekdays: number[];
    start_hour: number;
    end_hour: number;
    is_default: boolean;
  };
  preferred_notification_hour: number | null;
  segment: string | null;
  return_probability_24h: number | null;
  fatigue_score: number;
  ignored_streak: number;
  motivation: Record<string, number>;
  last_delivery: {
    notification_type: string;
    sent_at: string;
    outcome: string;
    candidate_score: number | null;
    reason: string | null;
  } | null;
  candidates: EngagementDebugCandidate[];
  decision: {
    should_send: boolean;
    chosen_type: string | null;
    score: number;
    reason: string;
    scheduled_at: string | null;
  };
};

/** Stage 1 (fewer than four sessions): the engine still runs on default timing and priors. */
const COLD_START_STAGE = 1;
export const SESSIONS_TO_LEAVE_COLD_START = 4;

export function isColdStart(debug: EngagementDebug): boolean {
  return debug.profile.stage === COLD_START_STAGE;
}

export function fetchEngagementDebug(token: string): Promise<EngagementDebug> {
  return apiJson<EngagementDebug>("/engagement/debug", { token });
}
