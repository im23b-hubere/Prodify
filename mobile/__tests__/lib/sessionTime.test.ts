import type { TFunction } from "i18next";

import {
  effectiveElapsedSeconds,
  openElapsedSeconds,
  formatDurationWords,
  mergeSessionPauseTiming,
} from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";

const t = ((key: string, options?: { count?: number; h?: number; m?: number }) => {
  if (key === "time.lessThanAMinute") return "less than a minute";
  if (key === "time.oneMinute") return "1 minute";
  if (key === "time.minutes") return `${options?.count} minutes`;
  if (key === "time.oneHour") return "1 hour";
  if (key === "time.hours") return `${options?.count} hours`;
  if (key === "time.hoursAndMinutes") return `${options?.h}h ${options?.m}m`;
  return key;
}) as TFunction;

function baseSession(overrides: Partial<SessionDto> = {}): SessionDto {
  return {
    id: 1,
    user_id: 1,
    session_type: "beat_making",
    started_at: "2026-06-10T12:00:00Z",
    stopped_at: null,
    paused_duration_seconds: 0,
    pause_started_at: null,
    duration_seconds: null,
    mood_level: null,
    notes: null,
    tags: null,
    ...overrides,
  };
}

describe("effectiveElapsedSeconds", () => {
  it("freezes elapsed while paused even when nowMs lags behind pause_started_at", () => {
    const session = baseSession({
      pause_started_at: "2026-06-10T12:01:05Z",
    });
    const pauseMs = Date.parse("2026-06-10T12:01:05Z");

    expect(effectiveElapsedSeconds(session, pauseMs - 2000)).toBe(65);
    expect(effectiveElapsedSeconds(session, pauseMs - 1000)).toBe(65);
    expect(effectiveElapsedSeconds(session, pauseMs + 5000)).toBe(65);
    expect(openElapsedSeconds(session, pauseMs + 5000)).toBe(70);
  });

  it("prefers the earlier client pause timestamp when merging server response", () => {
    const server = baseSession({
      pause_started_at: "2026-06-10T12:01:07Z",
      paused_duration_seconds: 0,
    });

    const merged = mergeSessionPauseTiming("2026-06-10T12:01:05Z", server);
    expect(merged.pause_started_at).toBe("2026-06-10T12:01:05Z");
  });

  it("counts active time normally when not paused", () => {
    const session = baseSession();
    const nowMs = Date.parse("2026-06-10T12:02:30Z");

    expect(effectiveElapsedSeconds(session, nowMs)).toBe(150);
  });
});

describe("formatDurationWords", () => {
  it("formats durations through i18n keys", () => {
    expect(formatDurationWords(20, t)).toBe("less than a minute");
    expect(formatDurationWords(60, t)).toBe("1 minute");
    expect(formatDurationWords(120, t)).toBe("2 minutes");
    expect(formatDurationWords(3600, t)).toBe("1 hour");
    expect(formatDurationWords(7200, t)).toBe("2 hours");
    expect(formatDurationWords(3660, t)).toBe("1h 1m");
  });
});
