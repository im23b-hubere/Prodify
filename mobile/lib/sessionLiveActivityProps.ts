import type { SessionDto } from "../types/session";
import { parseSessionDate } from "./sessionTime";

/** Everything the Live Activity renders; it runs isolated from the app, so text arrives pre-localized. */
export type SessionActivityProps = {
  sessionId: number;
  title: string;
  statusLabel: string;
  isPaused: boolean;
  /** Session start moved forward by completed pauses, so a native count-up timer skips them. */
  timerStartMs: number;
  pausedAtMs: number | null;
};

export type SessionActivityCopy = {
  title: (sessionType: string) => string;
  running: string;
  paused: string;
};

/** Returns null when there is nothing running to show. */
export function buildSessionActivityProps(
  session: SessionDto,
  copy: SessionActivityCopy,
): SessionActivityProps | null {
  if (session.stopped_at != null) return null;
  const startedMs = parseSessionDate(session.started_at).getTime();
  if (!Number.isFinite(startedMs)) return null;

  const pausedAtMs = readPauseStart(session.pause_started_at);
  const isPaused = pausedAtMs != null;
  return {
    sessionId: session.id,
    title: copy.title(String(session.session_type)),
    statusLabel: isPaused ? copy.paused : copy.running,
    isPaused,
    timerStartMs: startedMs + completedPauseSeconds(session) * 1000,
    pausedAtMs,
  };
}

function completedPauseSeconds(session: SessionDto): number {
  const seconds = session.paused_duration_seconds ?? 0;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function readPauseStart(pauseStartedAt: string | null | undefined): number | null {
  if (!pauseStartedAt?.trim()) return null;
  const pausedAtMs = parseSessionDate(pauseStartedAt).getTime();
  return Number.isFinite(pausedAtMs) ? pausedAtMs : null;
}
