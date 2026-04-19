import type { SessionDto } from "../types/session";

/**
 * Defensively parse a session payload from the API.
 * Prevents crashes when the server returns an unexpected shape or partial JSON.
 */
export function tryParseSessionDto(value: unknown): SessionDto | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const id = v.id;
  const started_at = v.started_at;
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) return null;
  if (typeof started_at !== "string" || !started_at.trim()) return null;

  const user_id = typeof v.user_id === "number" && Number.isFinite(v.user_id) ? v.user_id : 0;
  const stopped_at =
    v.stopped_at === null || v.stopped_at === undefined
      ? null
      : typeof v.stopped_at === "string"
        ? v.stopped_at
        : null;
  const duration_seconds =
    v.duration_seconds === null || v.duration_seconds === undefined
      ? null
      : typeof v.duration_seconds === "number" && Number.isFinite(v.duration_seconds)
        ? v.duration_seconds
        : null;
  const session_type =
    typeof v.session_type === "string" && v.session_type.trim() ? v.session_type : "beat_making";
  const notes =
    v.notes === null || v.notes === undefined ? null : typeof v.notes === "string" ? v.notes : null;

  let tags: string[] | null | undefined;
  if (Array.isArray(v.tags)) {
    tags = v.tags.filter((t): t is string => typeof t === "string");
  } else {
    tags = null;
  }

  const mood_level =
    v.mood_level === null
      ? null
      : typeof v.mood_level === "number" && Number.isFinite(v.mood_level)
        ? v.mood_level
        : undefined;

  const paused_duration_seconds =
    typeof v.paused_duration_seconds === "number" && Number.isFinite(v.paused_duration_seconds)
      ? v.paused_duration_seconds
      : 0;
  const pause_started_at =
    v.pause_started_at === null || v.pause_started_at === undefined
      ? null
      : typeof v.pause_started_at === "string"
        ? v.pause_started_at
        : null;

  const focus_score =
    v.focus_score === null || v.focus_score === undefined
      ? null
      : typeof v.focus_score === "number" && Number.isFinite(v.focus_score)
        ? Math.round(v.focus_score)
        : null;

  return {
    id,
    user_id,
    started_at,
    stopped_at,
    duration_seconds,
    session_type: session_type as SessionDto["session_type"],
    notes,
    mood_level: mood_level ?? undefined,
    tags,
    paused_duration_seconds,
    pause_started_at,
    focus_score,
  };
}

/** Coerce list endpoint payloads to DTOs; drops invalid rows instead of crashing the list. */
export function parseSessionList(value: unknown): SessionDto[] {
  if (!Array.isArray(value)) return [];
  const out: SessionDto[] = [];
  for (const row of value) {
    const s = tryParseSessionDto(row);
    if (s) out.push(s);
  }
  return out;
}

/** Safe tag list for UI (.map); handles legacy or malformed `tags` fields. */
export function sessionTagsList(tags: SessionDto["tags"] | unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
}
