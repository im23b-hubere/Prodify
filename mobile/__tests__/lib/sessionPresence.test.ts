import {
  SESSION_IDLE_AWAY_MS,
  SESSION_LONG_RUN_SECONDS,
  decideSessionPresence,
  effectiveLeftAtMs,
  isSessionRunning,
} from "../../lib/sessionPresence";

const NOW = Date.parse("2026-10-06T20:00:00.000Z");

describe("isSessionRunning", () => {
  it("is false without a session, when paused, or when already stopped", () => {
    expect(isSessionRunning(null)).toBe(false);
    expect(isSessionRunning({ pause_started_at: "2026-10-06T19:00:00.000Z", stopped_at: null })).toBe(
      false,
    );
    expect(isSessionRunning({ pause_started_at: null, stopped_at: "2026-10-06T19:50:00.000Z" })).toBe(
      false,
    );
  });

  it("is true for an unpaused, unstopped session", () => {
    expect(isSessionRunning({ pause_started_at: null, stopped_at: null })).toBe(true);
    expect(isSessionRunning({ pause_started_at: "  ", stopped_at: null })).toBe(true);
  });
});

describe("decideSessionPresence", () => {
  it("does nothing when the session is not running", () => {
    expect(
      decideSessionPresence({
        isRunning: false,
        leftAtMs: NOW - SESSION_IDLE_AWAY_MS,
        nowMs: NOW,
        elapsedSeconds: SESSION_LONG_RUN_SECONDS,
        longRunPrompted: false,
      }),
    ).toEqual({ kind: "none" });
  });

  it("does not pause for a short background trip", () => {
    expect(
      decideSessionPresence({
        isRunning: true,
        leftAtMs: NOW - (SESSION_IDLE_AWAY_MS - 1),
        nowMs: NOW,
        elapsedSeconds: 60,
        longRunPrompted: false,
      }),
    ).toEqual({ kind: "none" });
  });

  it("pauses from the moment they left after a long background trip", () => {
    const leftAtMs = NOW - SESSION_IDLE_AWAY_MS;
    expect(
      decideSessionPresence({
        isRunning: true,
        leftAtMs,
        nowMs: NOW,
        elapsedSeconds: 60,
        longRunPrompted: false,
      }),
    ).toEqual({ kind: "check-in", pauseAtMs: leftAtMs, reason: "away" });
  });

  it("uses leftAt, not now, even after a much longer absence", () => {
    const leftAtMs = NOW - 30 * 60 * 1000;
    expect(
      decideSessionPresence({
        isRunning: true,
        leftAtMs,
        nowMs: NOW,
        elapsedSeconds: 120,
        longRunPrompted: false,
      }).pauseAtMs,
    ).toBe(leftAtMs);
  });

  it("asks after a long foreground run without leaving", () => {
    expect(
      decideSessionPresence({
        isRunning: true,
        leftAtMs: null,
        nowMs: NOW,
        elapsedSeconds: SESSION_LONG_RUN_SECONDS,
        longRunPrompted: false,
      }),
    ).toEqual({ kind: "check-in", pauseAtMs: NOW, reason: "long-run" });
  });

  it("does not repeat the long-run check-in for the same stretch", () => {
    expect(
      decideSessionPresence({
        isRunning: true,
        leftAtMs: null,
        nowMs: NOW,
        elapsedSeconds: SESSION_LONG_RUN_SECONDS + 60,
        longRunPrompted: true,
      }),
    ).toEqual({ kind: "none" });
  });

  it("prefers pausing from leftAt when away and long-run both apply", () => {
    const leftAtMs = NOW - SESSION_IDLE_AWAY_MS;
    expect(
      decideSessionPresence({
        isRunning: true,
        leftAtMs,
        nowMs: NOW,
        elapsedSeconds: SESSION_LONG_RUN_SECONDS,
        longRunPrompted: false,
      }),
    ).toEqual({ kind: "check-in", pauseAtMs: leftAtMs, reason: "away" });
  });

  it("ignores a leftAt that is in the future", () => {
    expect(
      decideSessionPresence({
        isRunning: true,
        leftAtMs: NOW + 1000,
        nowMs: NOW,
        elapsedSeconds: 10,
        longRunPrompted: false,
      }),
    ).toEqual({ kind: "none" });
  });
});

describe("effectiveLeftAtMs", () => {
  it("drops a leftover trip from before this session started", () => {
    expect(effectiveLeftAtMs(NOW - SESSION_IDLE_AWAY_MS, NOW)).toBeNull();
  });

  it("keeps a trip that started after the session", () => {
    const leftAtMs = NOW - SESSION_IDLE_AWAY_MS;
    expect(effectiveLeftAtMs(leftAtMs, NOW - 30 * 60 * 1000)).toBe(leftAtMs);
  });
});
