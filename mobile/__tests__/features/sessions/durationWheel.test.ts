import {
  clampDurationMinutes,
  countedMinutes,
  durationParts,
  showsHoursColumn,
} from "../../../features/sessions/durationWheel";

describe("duration wheel", () => {
  it("counts whole minutes of a counted session", () => {
    expect(countedMinutes(92 * 60)).toBe(92);
    expect(countedMinutes(4 * 60)).toBe(0);
  });

  it("shows hours only when the cap is at least an hour", () => {
    expect(showsHoursColumn(92)).toBe(true);
    expect(showsHoursColumn(60)).toBe(true);
    expect(showsHoursColumn(46)).toBe(false);
  });

  it("splits and clamps to the session cap", () => {
    expect(durationParts(92)).toEqual({ hours: 1, minutes: 32 });
    expect(durationParts(46)).toEqual({ hours: 0, minutes: 46 });
    expect(clampDurationMinutes(2 * 60, 92)).toBe(92);
    expect(clampDurationMinutes(-4, 92)).toBe(0);
  });
});
