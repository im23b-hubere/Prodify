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

  it("keeps this Monday and drops the previous Sunday when the week is pinned to Wednesday", () => {
    const wednesday = new Date(2026, 9, 21, 15, 0, 0);
    const sessions = [
      session(1, new Date(2026, 9, 19, 0, 30, 0).toISOString()),
      session(2, new Date(2026, 9, 18, 23, 0, 0).toISOString()),
    ];

    expect(filterSessionsByStatsPeriod(sessions, "week", wednesday).map((item) => item.id)).toEqual([
      1,
    ]);
  });

  it("filters sessions by week period", () => {
    const wednesday = new Date(2026, 9, 21, 12, 0, 0);
    const sessions = [
      session(1, new Date(2026, 9, 19, 12, 0, 0).toISOString()),
      session(2, new Date(2026, 9, 11, 12, 0, 0).toISOString()),
    ];

    expect(filterSessionsByStatsPeriod(sessions, "week", wednesday).map((item) => item.id)).toEqual([
      1,
    ]);
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
