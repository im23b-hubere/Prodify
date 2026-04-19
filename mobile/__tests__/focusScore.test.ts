import i18n from "../lib/i18n";
import { calculateFocusScore, getFocusScoreMessage } from "../lib/focusScore";

describe("calculateFocusScore", () => {
  test("returns 0 when no active duration", () => {
    expect(
      calculateFocusScore({
        duration_minutes: 0,
        paused_duration_minutes: 0,
        session_type: "Beat Making",
        notes_length: 0,
        mood_level: 3,
      }),
    ).toBe(0);
  });

  test("caps score at 100 for strong sessions", () => {
    const score = calculateFocusScore({
      duration_minutes: 90,
      paused_duration_minutes: 0,
      session_type: "Beat Making",
      notes_length: 80,
      mood_level: 5,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(80);
  });
});

describe("getFocusScoreMessage", () => {
  test("returns encouragement for low scores", () => {
    expect(getFocusScoreMessage(40)).toBe(i18n.t("focusScore.messages.roomForImprovement"));
  });
});
