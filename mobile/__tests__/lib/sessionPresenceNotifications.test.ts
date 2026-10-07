import {
  SESSION_AUTO_STOP_SECONDS,
  SESSION_STILL_THERE_SECONDS,
} from "../../lib/sessionPresence";
import { sessionPresenceSchedule } from "../../lib/sessionPresenceNotifications";
import type { SessionDto } from "../../types/session";

const startedAt = "2026-10-06T12:00:00.000Z";
const startedAtMs = Date.parse(startedAt);

const running: SessionDto = {
  id: 7,
  user_id: 1,
  started_at: startedAt,
  stopped_at: null,
  duration_seconds: null,
  session_type: "beat_making",
  notes: null,
  pause_started_at: null,
  paused_duration_seconds: 0,
};

describe("sessionPresenceSchedule", () => {
  it("schedules still-there and auto-stop from remaining work time", () => {
    const fromMs = startedAtMs + 60_000;
    const plan = sessionPresenceSchedule(running, fromMs);
    expect(plan.stillThere?.getTime()).toBe(startedAtMs + SESSION_STILL_THERE_SECONDS * 1000);
    expect(plan.autoStop?.getTime()).toBe(startedAtMs + SESSION_AUTO_STOP_SECONDS * 1000);
  });

  it("schedules nothing while paused or already stopped", () => {
    const fromMs = startedAtMs + 60_000;
    expect(
      sessionPresenceSchedule({ ...running, pause_started_at: "2026-10-06T12:10:00.000Z" }, fromMs),
    ).toEqual({ stillThere: null, autoStop: null });
    expect(
      sessionPresenceSchedule({ ...running, stopped_at: "2026-10-06T13:00:00.000Z" }, fromMs),
    ).toEqual({ stillThere: null, autoStop: null });
  });
});
