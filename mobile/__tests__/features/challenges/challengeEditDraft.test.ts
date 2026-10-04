import {
  challengeTermsLocked,
  parseChallengeEditDraft,
} from "../../../features/challenges/challengeEditDraft";

describe("challenge edit draft", () => {
  it("normalizes a valid draft", () => {
    expect(parseChallengeEditDraft("  Finish EP  ", "6", "14")).toEqual({
      title: "Finish EP",
      target_sessions: 6,
      duration_days: 14,
    });
  });

  it.each([
    ["No", "5", "7"],
    ["Valid title", "0", "7"],
    ["Valid title", "invalid", "7"],
    ["Valid title", "5", "2"],
    ["Valid title", "5", "invalid"],
  ])("rejects invalid values", (title, target, duration) => {
    expect(parseChallengeEditDraft(title, target, duration)).toBeNull();
  });

  it("sends only the title when the terms are locked, even if other fields hold stale values", () => {
    expect(parseChallengeEditDraft(" Rematch ", "0", "", { termsLocked: true })).toEqual({
      title: "Rematch",
    });
  });

  it("still rejects a too short title when the terms are locked", () => {
    expect(parseChallengeEditDraft("No", "5", "7", { termsLocked: true })).toBeNull();
  });
});

describe("challengeTermsLocked", () => {
  it("locks target and duration for duels only", () => {
    expect(challengeTermsLocked({ challenge_kind: "duel" })).toBe(true);
    expect(challengeTermsLocked({ challenge_kind: "team" })).toBe(false);
  });
});
