export const SESSION_IDLE_AWAY_MS = 10 * 60 * 1000;
export const SESSION_LONG_RUN_SECONDS = 3 * 60 * 60;

export type SessionPresenceSnapshot = {
  pause_started_at?: string | null;
  stopped_at?: string | null;
};

export function isSessionRunning(session: SessionPresenceSnapshot | null): boolean {
  if (!session) return false;
  if (session.stopped_at) return false;
  if (session.pause_started_at?.trim()) return false;
  return true;
}

export type SessionPresenceInput = {
  isRunning: boolean;
  leftAtMs: number | null;
  nowMs: number;
  elapsedSeconds: number;
  longRunPrompted: boolean;
};

export type SessionPresenceDecision =
  | { kind: "none" }
  | { kind: "check-in"; pauseAtMs: number; reason: "away" | "long-run" };

export function decideSessionPresence(input: SessionPresenceInput): SessionPresenceDecision {
  if (!input.isRunning) return { kind: "none" };

  const { leftAtMs, nowMs } = input;
  if (leftAtMs != null && nowMs >= leftAtMs && nowMs - leftAtMs >= SESSION_IDLE_AWAY_MS) {
    return { kind: "check-in", pauseAtMs: leftAtMs, reason: "away" };
  }

  if (!input.longRunPrompted && input.elapsedSeconds >= SESSION_LONG_RUN_SECONDS) {
    return { kind: "check-in", pauseAtMs: nowMs, reason: "long-run" };
  }

  return { kind: "none" };
}

let leftAtMs: number | null = null;
let promptOpen = false;
let longRunPromptedSessionId: number | null = null;
let lastPresencePause: { sessionId: number; pausedAtMs: number } | null = null;

export function noteSessionWentAway(nowMs: number): void {
  if (leftAtMs == null) leftAtMs = nowMs;
}

export function peekSessionLeftAtMs(): number | null {
  return leftAtMs;
}

export function clearSessionLeftAtMs(): void {
  leftAtMs = null;
}

export function beginSessionPresencePrompt(): boolean {
  if (promptOpen) return false;
  promptOpen = true;
  return true;
}

export function endSessionPresencePrompt(): void {
  promptOpen = false;
}

export function wasLongRunPrompted(sessionId: number): boolean {
  return longRunPromptedSessionId === sessionId;
}

export function markLongRunPrompted(sessionId: number): void {
  longRunPromptedSessionId = sessionId;
}

export function rememberPresencePause(sessionId: number, pausedAtMs: number): void {
  lastPresencePause = { sessionId, pausedAtMs };
}

export function peekPresencePause(sessionId: number): number | null {
  if (lastPresencePause?.sessionId !== sessionId) return null;
  return lastPresencePause.pausedAtMs;
}

export function followPresencePause(sessionId: number): number | null {
  if (!promptOpen) return null;
  return peekPresencePause(sessionId);
}

export function abandonPresenceAttempt(sessionId: number, reason: "away" | "long-run"): void {
  clearSessionLeftAtMs();
  if (reason === "long-run") markLongRunPrompted(sessionId);
  endSessionPresencePrompt();
}

export function isBackgroundAppState(state: string): boolean {
  return state === "inactive" || state === "background";
}

export function effectiveLeftAtMs(
  leftAtMs: number | null,
  sessionStartedAtMs: number,
): number | null {
  if (leftAtMs == null || !Number.isFinite(sessionStartedAtMs)) return null;
  if (leftAtMs < sessionStartedAtMs) return null;
  return leftAtMs;
}

export function resetSessionPresenceStateForTests(): void {
  leftAtMs = null;
  promptOpen = false;
  longRunPromptedSessionId = null;
  lastPresencePause = null;
}
