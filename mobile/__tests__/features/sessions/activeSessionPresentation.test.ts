import { formatSessionClock } from "../../../features/sessions/activeSessionPresentation";

describe("active session presentation", () => {
  it("formats elapsed seconds as an unbounded minute clock", () => {
    expect(formatSessionClock(0)).toBe("00:00");
    expect(formatSessionClock(65)).toBe("01:05");
    expect(formatSessionClock(3_661)).toBe("61:01");
  });

  it("normalizes invalid elapsed values", () => {
    expect(formatSessionClock(-1)).toBe("00:00");
    expect(formatSessionClock(Number.NaN)).toBe("00:00");
  });
});
