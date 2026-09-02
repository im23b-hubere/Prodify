import { getCurrentWeekProgress, getStreak, parseApiDate } from "../../../features/dashboard/utils";
import { weekDateKeys } from "../../../lib/weekCalendar";
import type { SessionDto } from "../../../types/session";

function session(startedAt: string, id = 1): SessionDto {
  return {
    id,
    user_id: 1,
    started_at: startedAt,
    stopped_at: "2026-07-01T12:00:00Z",
    duration_seconds: 1800,
    session_type: "beat_making",
    notes: null,
  };
}

describe("dashboard utils", () => {
  it("parses API dates without timezone as UTC", () => {
    const parsed = parseApiDate("2026-07-01T10:00:00");
    expect(parsed.toISOString()).toBe("2026-07-01T10:00:00.000Z");
  });

  it("computes streak across consecutive local days", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const streak = getStreak([
      session(today.toISOString(), 1),
      session(yesterday.toISOString(), 2),
    ]);
    expect(streak).toBeGreaterThanOrEqual(2);
  });

  it("returns zero streak when last session was more than one day ago", () => {
    const old = new Date();
    old.setDate(old.getDate() - 5);
    expect(getStreak([session(old.toISOString())])).toBe(0);
  });

  it("marks sessions on the current Monday–Sunday week", () => {
    const wednesday = new Date(2026, 8, 2, 12, 0, 0);
    const keys = weekDateKeys(0, wednesday);
    expect(keys[0]).toBe("2026-08-31");
    expect(keys[2]).toBe("2026-09-02");

    const progress = getCurrentWeekProgress([session(wednesday.toISOString())], wednesday);
    expect(progress).toHaveLength(7);
    expect(progress[2]).toBe(true);
    expect(progress.filter(Boolean)).toHaveLength(1);
    expect(progress[6]).toBe(false);
  });
});
