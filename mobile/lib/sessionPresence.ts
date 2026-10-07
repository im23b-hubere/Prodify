export const SESSION_STILL_THERE_SECONDS = 3 * 60 * 60;
export const SESSION_AUTO_STOP_SECONDS = 8 * 60 * 60;

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

export type SessionPresenceDecision = { kind: "none" } | { kind: "still-there" } | { kind: "auto-stop" };

export function decideSessionPresence(input: {
  isRunning: boolean;
  elapsedSeconds: number;
  stillTherePrompted: boolean;
}): SessionPresenceDecision {
  if (!input.isRunning) return { kind: "none" };
  if (input.elapsedSeconds >= SESSION_AUTO_STOP_SECONDS) return { kind: "auto-stop" };
  if (!input.stillTherePrompted && input.elapsedSeconds >= SESSION_STILL_THERE_SECONDS) {
    return { kind: "still-there" };
  }
  return { kind: "none" };
}

export function presenceFireDate(
  startedAtMs: number,
  pausedDurationSeconds: number,
  thresholdSeconds: number,
  fromMs: number,
): Date | null {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(fromMs)) return null;
  const paused = Number.isFinite(pausedDurationSeconds) ? Math.max(0, pausedDurationSeconds) : 0;
  const fireMs = startedAtMs + (paused + thresholdSeconds) * 1000;
  if (!Number.isFinite(fireMs) || fireMs <= fromMs) return null;
  return new Date(fireMs);
}

let promptOpen = false;
let stillTherePromptedSessionId: number | null = null;
let autoStoppingSessionId: number | null = null;

export function beginSessionPresencePrompt(): boolean {
  if (promptOpen) return false;
  promptOpen = true;
  return true;
}

export function endSessionPresencePrompt(): void {
  promptOpen = false;
}

export function wasStillTherePrompted(sessionId: number): boolean {
  return stillTherePromptedSessionId === sessionId;
}

export function markStillTherePrompted(sessionId: number): void {
  stillTherePromptedSessionId = sessionId;
}

export function beginSessionAutoStop(sessionId: number): boolean {
  if (autoStoppingSessionId === sessionId) return false;
  autoStoppingSessionId = sessionId;
  return true;
}

export function abandonSessionAutoStop(sessionId: number): void {
  if (autoStoppingSessionId === sessionId) autoStoppingSessionId = null;
}

export function isBackgroundAppState(state: string): boolean {
  return state === "inactive" || state === "background";
}

export function resetSessionPresenceStateForTests(): void {
  promptOpen = false;
  stillTherePromptedSessionId = null;
  autoStoppingSessionId = null;
}
