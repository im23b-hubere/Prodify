import {
  SESSION_AUTO_STOP_SECONDS,
  SESSION_STILL_THERE_SECONDS,
  decideSessionPresence,
  isSessionRunning,
  presenceFireDate,
} from "../../lib/sessionPresence";

describe("isSessionRunning", () => {
  it("is false without a session, when paused, or when already stopped", () => {
    expect(isSessionRunning(null)).toBe(false);
    expect(
      isSessionRunning({ pause_started_at: "2026-10-06T19:00:00.000Z", stopped_at: null }),
    ).toBe(false);
    expect(
      isSessionRunning({ pause_started_at: null, stopped_at: "2026-10-06T19:50:00.000Z" }),
    ).toBe(false);
  });

  it("is true for an unpaused, unstopped session", () => {
    expect(isSessionRunning({ pause_started_at: null, stopped_at: null })).toBe(true);
  });
});

describe("decideSessionPresence", () => {
  it("does nothing while the session is paused", () => {
    expect(
      decideSessionPresence({
        isRunning: false,
        elapsedSeconds: SESSION_AUTO_STOP_SECONDS,
        stillTherePrompted: false,
      }),
    ).toEqual({ kind: "none" });
  });

  it("does nothing before three hours", () => {
    expect(
      decideSessionPresence({
        isRunning: true,
        elapsedSeconds: SESSION_STILL_THERE_SECONDS - 1,
        stillTherePrompted: false,
      }),
    ).toEqual({ kind: "none" });
  });

  it("asks still-there after three hours", () => {
    expect(
      decideSessionPresence({
        isRunning: true,
        elapsedSeconds: SESSION_STILL_THERE_SECONDS,
        stillTherePrompted: false,
      }),
    ).toEqual({ kind: "still-there" });
  });

  it("does not repeat the still-there prompt", () => {
    expect(
      decideSessionPresence({
        isRunning: true,
        elapsedSeconds: SESSION_STILL_THERE_SECONDS + 60,
        stillTherePrompted: true,
      }),
    ).toEqual({ kind: "none" });
  });

  it("stops after eight hours even if still-there already asked", () => {
    expect(
      decideSessionPresence({
        isRunning: true,
        elapsedSeconds: SESSION_AUTO_STOP_SECONDS,
        stillTherePrompted: true,
      }),
    ).toEqual({ kind: "auto-stop" });
  });
});

describe("presenceFireDate", () => {
  const startedAtMs = Date.parse("2026-10-06T12:00:00.000Z");

  it("schedules the still-there fire from elapsed work, not wall clock pauses", () => {
    const fromMs = startedAtMs + 60_000;
    const fire = presenceFireDate(startedAtMs, 600, SESSION_STILL_THERE_SECONDS, fromMs);
    expect(fire?.toISOString()).toBe(
      new Date(startedAtMs + (600 + SESSION_STILL_THERE_SECONDS) * 1000).toISOString(),
    );
  });

  it("returns null when the threshold has already passed", () => {
    const fromMs = startedAtMs + SESSION_AUTO_STOP_SECONDS * 1000;
    expect(presenceFireDate(startedAtMs, 0, SESSION_AUTO_STOP_SECONDS, fromMs)).toBeNull();
  });
});
