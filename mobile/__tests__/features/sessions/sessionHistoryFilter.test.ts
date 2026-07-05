import type { SessionDto } from "../../../types/session";
import {
  filterCompletedSessions,
  filterSessionsByStatsPeriod,
} from "../../../features/sessions/utils/sessionHistoryFilter";

function session(
  id: number,
  startedAt: string,
  stoppedAt: string | null = "2026-07-01T12:00:00Z",
): SessionDto {
  return {
    id,
    user_id: 1,
    started_at: startedAt,
    stopped_at: stoppedAt,
    duration_seconds: 1800,
    session_type: "beat_making",
    notes: null,
  };
}

describe("sessionHistoryFilter", () => {
  it("keeps only completed sessions", () => {
    const sessions = [session(1, "2026-07-01T10:00:00Z"), session(2, "2026-07-02T10:00:00Z", null)];
    expect(filterCompletedSessions(sessions).map((item) => item.id)).toEqual([1]);
  });

  it("filters sessions by week period", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const withinWeek = new Date(today);
    withinWeek.setDate(today.getDate() - 2);
    const outsideWeek = new Date(today);
    outsideWeek.setDate(today.getDate() - 10);

    const sessions = [session(1, withinWeek.toISOString()), session(2, outsideWeek.toISOString())];

    expect(filterSessionsByStatsPeriod(sessions, "week").map((item) => item.id)).toEqual([1]);
  });

  it("returns all completed sessions for all period", () => {
    const sessions = [
      session(1, "2026-07-05T10:00:00Z"),
      session(2, "2026-06-20T10:00:00Z"),
      session(3, "2026-06-10T10:00:00Z", null),
    ];
    expect(filterSessionsByStatsPeriod(sessions, "all").map((item) => item.id)).toEqual([1, 2]);
  });
});
