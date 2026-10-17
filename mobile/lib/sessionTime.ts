import type { TFunction } from "i18next";

import type { SessionDto } from "../types/session";
import { currentAppLocaleTag } from "./appLocale";

/** Parse API datetime; assume UTC if no offset. */
export function parseSessionDate(value: string): Date {
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

/** Elapsed active seconds (excludes paused intervals). Matches server stop logic. */
export function effectiveElapsedSeconds(session: SessionDto, nowMs: number): number {
  if (!session?.started_at?.trim()) return 0;
  const startedMs = parseSessionDate(session.started_at).getTime();
  if (!Number.isFinite(startedMs)) return 0;
  let paused = session.paused_duration_seconds ?? 0;
  if (!Number.isFinite(paused) || paused < 0) paused = 0;
  if (session.pause_started_at?.trim()) {
    const ps = parseSessionDate(session.pause_started_at).getTime();
    if (Number.isFinite(ps)) {
      // Freeze at pause moment — avoids creep from 1s UI ticks or later server pause_started_at.
      const grossAtPause = Math.floor((ps - startedMs) / 1000);
      const net = grossAtPause - paused;
      if (!Number.isFinite(net)) return 0;
      return Math.max(0, net);
    }
  }
  const gross = Math.floor((nowMs - startedMs) / 1000);
  const net = gross - paused;
  if (!Number.isFinite(net)) return 0;
  return Math.max(0, net);
}

/** Keep client pause timestamp when server confirms later — avoids timer jumping forward. */
export function mergeSessionPauseTiming(
  clientPauseStartedAt: string | null | undefined,
  server: SessionDto,
): SessionDto {
  if (!clientPauseStartedAt?.trim() || !server.pause_started_at?.trim()) return server;
  const clientMs = parseSessionDate(clientPauseStartedAt).getTime();
  const serverMs = parseSessionDate(server.pause_started_at).getTime();
  if (Number.isFinite(clientMs) && Number.isFinite(serverMs) && clientMs <= serverMs) {
    return { ...server, pause_started_at: clientPauseStartedAt };
  }
  return server;
}

export function formatDurationWords(totalSeconds: number, t: TFunction): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds >= 0 ? totalSeconds : 0;
  const mins = Math.round(safe / 60);
  if (mins < 1) return t("time.lessThanAMinute");
  if (mins < 60) {
    return mins === 1 ? t("time.oneMinute") : t("time.minutes", { count: mins });
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m) return t("time.hoursAndMinutes", { h, m });
  return h === 1 ? t("time.oneHour") : t("time.hours", { count: h });
}

/** Short calendar date for lists; returns em dash if ISO is missing or invalid. */
export function formatSessionListDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = parseSessionDate(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Weekday letter for trend chart axis; safe for bad ISO day keys. */
export function weekdayLetterFromIsoDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "?";
  const d = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return "?";
  return d.toLocaleDateString(currentAppLocaleTag(), { weekday: "short" });
}

/** Calendar day key YYYY-MM-DD → short local date for chart axis (e.g. 4/23). */
export function formatIsoDateShortLocal(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "?";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (!Number.isFinite(dt.getTime())) return "?";
  return dt.toLocaleDateString(currentAppLocaleTag(), { month: "numeric", day: "numeric" });
}
