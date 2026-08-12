import { mergeUniqueSessions } from "../../../features/sessions/hooks/useSessionTrash";
import type { SessionDto } from "../../../types/session";

function session(id: number): SessionDto {
  return {
    id,
    user_id: 1,
    session_type: "beat_making",
    started_at: "2026-08-10T10:00:00Z",
    stopped_at: "2026-08-10T10:30:00Z",
    duration_seconds: 1800,
    notes: null,
    mood_level: null,
    tags: null,
    paused_duration_seconds: 0,
    pause_started_at: null,
    focus_score: null,
    track_outcome: null,
    track_title: null,
  };
}

describe("session trash pagination", () => {
  it("appends only sessions that are not already present", () => {
    const current = [session(1), session(2)];

    expect(mergeUniqueSessions(current, [session(2), session(3)]).map(({ id }) => id)).toEqual([
      1, 2, 3,
    ]);
  });

  it("keeps the existing array when a page contains no additions", () => {
    const current = [session(1)];

    expect(mergeUniqueSessions(current, [session(1)])).toBe(current);
  });
});
