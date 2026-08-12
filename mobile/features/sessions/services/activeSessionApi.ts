import { apiJson } from "../../../lib/client";
import { parseSessionList, tryParseSessionDto } from "../../../lib/sessionDto";
import type { SessionDto, SessionType } from "../../../types/session";

export async function resolveActiveSessionId(
  token: string,
  requestedId: string | undefined,
): Promise<number | null> {
  if (requestedId) return positiveId(requestedId);
  try {
    const active = await apiJson<unknown>("/sessions/active", { token });
    return activeSessionId(active);
  } catch {
    return null;
  }
}

export async function fetchActiveSession(
  token: string,
  sessionId: number,
): Promise<SessionDto | null> {
  const raw = await apiJson<unknown>(`/sessions/item/${sessionId}`, { token });
  return tryParseSessionDto(raw);
}

export async function fetchLongestCompletedSessionSeconds(token: string): Promise<number | null> {
  const raw = await apiJson<unknown>("/sessions/list?limit=200", { token });
  const longest = parseSessionList(raw)
    .filter(isCompletedSession)
    .reduce((maximum, session) => Math.max(maximum, session.duration_seconds ?? 0), 0);
  return longest > 0 ? longest : null;
}

export async function pauseActiveSession(
  token: string,
  sessionId: number,
): Promise<SessionDto | null> {
  const raw = await apiJson<unknown>(`/sessions/item/${sessionId}/pause`, {
    token,
    method: "POST",
  });
  return tryParseSessionDto(raw);
}

export async function resumeActiveSession(
  token: string,
  sessionId: number,
): Promise<SessionDto | null> {
  const raw = await apiJson<unknown>(`/sessions/item/${sessionId}/resume`, {
    token,
    method: "POST",
  });
  return tryParseSessionDto(raw);
}

export async function updateActiveSession(
  token: string,
  sessionId: number,
  changes: { notes?: string | null; session_type?: SessionType },
): Promise<SessionDto | null> {
  const raw = await apiJson<unknown>(`/sessions/item/${sessionId}`, {
    token,
    method: "PATCH",
    body: changes,
  });
  return tryParseSessionDto(raw);
}

export async function stopActiveSession(token: string, sessionId: number): Promise<void> {
  await apiJson<SessionDto>("/sessions/stop", {
    token,
    method: "POST",
    body: { session_id: sessionId },
  });
}

function positiveId(value: string | number): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function activeSessionId(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("id" in value)) return null;
  const id = value.id;
  return typeof id === "number" ? positiveId(id) : null;
}

function isCompletedSession(session: SessionDto): boolean {
  return Boolean(session.stopped_at) && (session.duration_seconds ?? 0) > 0;
}
