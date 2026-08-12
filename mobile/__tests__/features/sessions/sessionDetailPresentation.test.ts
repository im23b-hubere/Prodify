import type { TFunction } from "i18next";

import {
  buildSessionDetailPresentation,
  resolveSessionDetailParams,
} from "../../../features/sessions/sessionDetailPresentation";
import type { SessionDto } from "../../../types/session";

const t = ((key: string) => key) as TFunction;

const session = {
  id: 12,
  user_id: 1,
  started_at: "2026-04-21T10:00:00Z",
  stopped_at: "2026-04-21T11:00:00Z",
  duration_seconds: 3600,
  session_type: "beat_making",
  notes: "note",
  mood_level: 4,
  tags: ["drums", "mix"],
  paused_duration_seconds: 180,
  focus_score: 82,
  track_outcome: "finished",
} as SessionDto;

describe("session detail presentation", () => {
  it("prefers explicit route params and unwraps array values", () => {
    expect(resolveSessionDetailParams(["42", "unused"], ["Producer"], ["session", "12"])).toEqual({
      sessionId: "42",
      ownerName: "Producer",
    });
  });

  it("falls back to a numeric session path segment", () => {
    expect(resolveSessionDetailParams(undefined, undefined, ["session", "12"])).toEqual({
      sessionId: "12",
      ownerName: undefined,
    });
    expect(resolveSessionDetailParams(undefined, undefined, ["session", "invalid"]).sessionId).toBe(
      undefined,
    );
  });

  it("derives pause, focus and tag presentation without mutating the session", () => {
    const presentation = buildSessionDetailPresentation(
      session,
      {
        focus_score: 91,
        focus_label: "Strong",
        paused_seconds: 180,
        focus_tier: "strong",
        focus_percentile: 80,
        focus_user_average: 75,
        active_seconds: 3420,
        effective_rate_percent: 95,
        impact_items: [],
        impact_lines: [],
        productivity_items: [],
        productivity_insights: [],
        related_sessions: [],
        timeline: [
          { kind: "paused", seconds: 10 },
          { kind: "paused", seconds: 10 },
        ],
      },
      t,
    );

    expect(presentation.hasMeaningfulPause).toBe(true);
    expect(presentation.pauseCount).toBe(2);
    expect(presentation.focusScore).toBe(91);
    expect(presentation.tags).toEqual(["drums", "mix"]);
    expect(presentation.isActiveSession).toBe(false);
  });
});
