import { parseChallengeEditDraft } from "../../../features/challenges/challengeEditDraft";

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
});
