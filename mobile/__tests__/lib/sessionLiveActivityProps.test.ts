import {
  buildSessionActivityProps,
  type SessionActivityCopy,
} from "../../lib/sessionLiveActivityProps";
import type { SessionDto } from "../../types/session";

const copy: SessionActivityCopy = {
  title: (sessionType) => `title:${sessionType}`,
  running: "In the studio",
  paused: "Paused",
};

const startedAt = "2026-08-12T10:00:00Z";
const startedAtMs = Date.parse(startedAt);

function session(partial: Partial<SessionDto> = {}): SessionDto {
  return {
    id: 42,
    user_id: 7,
    started_at: startedAt,
    stopped_at: null,
    duration_seconds: null,
    session_type: "mixing",
    notes: null,
    paused_duration_seconds: 0,
    pause_started_at: null,
    ...partial,
  };
}

describe("buildSessionActivityProps", () => {
  it("counts up from the session start while it runs", () => {
    const props = buildSessionActivityProps(session(), copy);

    expect(props).toEqual({
      sessionId: 42,
      title: "title:mixing",
      statusLabel: "In the studio",
      isPaused: false,
      timerStartMs: startedAtMs,
      pausedAtMs: null,
    });
  });

  it("shifts the timer start by completed pauses so they are not counted", () => {
    const props = buildSessionActivityProps(session({ paused_duration_seconds: 600 }), copy);

    expect(props?.timerStartMs).toBe(startedAtMs + 600_000);
  });

  it("freezes the timer at the moment the session was paused", () => {
    const props = buildSessionActivityProps(
      session({ pause_started_at: "2026-08-12T10:30:00Z" }),
      copy,
    );

    expect(props).toMatchObject({
      isPaused: true,
      statusLabel: "Paused",
      pausedAtMs: Date.parse("2026-08-12T10:30:00Z"),
    });
  });

  it("reads server timestamps without an offset as UTC", () => {
    const props = buildSessionActivityProps(session({ started_at: "2026-08-12T10:00:00" }), copy);

    expect(props?.timerStartMs).toBe(startedAtMs);
  });

  it("shows nothing for a session that already stopped", () => {
    expect(buildSessionActivityProps(session({ stopped_at: "2026-08-12T11:00:00Z" }), copy)).toBeNull();
  });

  it("shows nothing when the start time cannot be read", () => {
    expect(buildSessionActivityProps(session({ started_at: "not a date" }), copy)).toBeNull();
  });
});
