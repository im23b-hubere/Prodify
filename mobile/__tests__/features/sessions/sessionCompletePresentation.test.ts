import {
  estimateSessionXpGain,
  shortenSessionLabel,
} from "../../../features/sessions/sessionCompletePresentation";

describe("session complete presentation", () => {
  it("does not award XP below the minimum counted duration", () => {
    expect(estimateSessionXpGain(4 * 60 + 59)).toBe(0);
  });

  it("applies duration bonuses and caps the XP estimate", () => {
    expect(estimateSessionXpGain(5 * 60)).toBe(5);
    expect(estimateSessionXpGain(25 * 60)).toBe(18);
    expect(estimateSessionXpGain(10_000 * 60)).toBe(85);
  });

  it("trims and shortens long progression labels", () => {
    expect(shortenSessionLabel("  Producer  ")).toBe("Producer");
    expect(shortenSessionLabel("Extraordinary Producer", 10)).toBe("Extraordi…");
  });
});
