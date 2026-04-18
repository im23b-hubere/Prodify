import type { SessionDto } from "../types/session";

/** Parse API datetime; assume UTC if no offset. */
export function parseSessionDate(value: string): Date {
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

/** Elapsed active seconds (excludes paused intervals). Matches server stop logic. */
export function effectiveElapsedSeconds(session: SessionDto, nowMs: number): number {
  const startedMs = parseSessionDate(session.started_at).getTime();
  let paused = session.paused_duration_seconds ?? 0;
  if (session.pause_started_at) {
    const ps = parseSessionDate(session.pause_started_at).getTime();
    paused += Math.max(0, Math.floor((nowMs - ps) / 1000));
  }
  const gross = Math.floor((nowMs - startedMs) / 1000);
  return Math.max(0, gross - paused);
}

export function formatDurationWords(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 1) return "less than a minute";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h} hour${h === 1 ? "" : "s"}`;
}
