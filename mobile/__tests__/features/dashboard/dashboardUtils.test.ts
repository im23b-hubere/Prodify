import {
  getLast7DaysProgress,
  getStreak,
  parseApiDate,
  toDateKey,
} from "../../../features/dashboard/utils";
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

  it("builds last-7-days progress with today as final slot", () => {
    const today = new Date();
    const progress = getLast7DaysProgress([session(`${toDateKey(today)}T10:00:00Z`)]);
    expect(progress).toHaveLength(7);
    expect(progress[6]).toBe(true);
    expect(progress.slice(0, 6).every((day) => !day)).toBe(true);
  });
});
