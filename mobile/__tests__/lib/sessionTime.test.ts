import { effectiveElapsedSeconds, mergeSessionPauseTiming } from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";

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
    const startedMs = Date.parse("2026-06-10T12:00:00Z");
    const pauseMs = Date.parse("2026-06-10T12:01:05Z");

    expect(effectiveElapsedSeconds(session, pauseMs - 2000)).toBe(65);
    expect(effectiveElapsedSeconds(session, pauseMs - 1000)).toBe(65);
    expect(effectiveElapsedSeconds(session, pauseMs + 5000)).toBe(65);
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
