import {
  clampDurationMinutes,
  countedMinutes,
  durationParts,
  minuteLimit,
  showsHoursColumn,
  WHEEL_ROW_HEIGHT,
  wheelIndexAt,
  wheelRowPose,
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

  it("picks the row nearest the centre of the drum", () => {
    expect(wheelIndexAt(0, 60)).toBe(0);
    expect(wheelIndexAt(WHEEL_ROW_HEIGHT * 4.4, 60)).toBe(4);
    expect(wheelIndexAt(WHEEL_ROW_HEIGHT * 4.6, 60)).toBe(5);
  });

  it("keeps an overscrolled drum on its first or last row", () => {
    expect(wheelIndexAt(-WHEEL_ROW_HEIGHT * 3, 60)).toBe(0);
    expect(wheelIndexAt(WHEEL_ROW_HEIGHT * 80, 60)).toBe(59);
  });

  it("allows every minute below the cap's last hour", () => {
    expect(minuteLimit(0, 92)).toBe(59);
  });

  it("stops the minutes at the cap in the cap's last hour", () => {
    expect(minuteLimit(1, 92)).toBe(32);
  });

  it("stops a minutes-only drum at the cap", () => {
    expect(minuteLimit(0, 46)).toBe(46);
  });
});

describe("duration wheel drum pose", () => {
  it("shows the centred row flat and fully lit", () => {
    const centre = wheelRowPose(0);

    expect(centre.rotateX).toBeCloseTo(0);
    expect(centre.translateY).toBeCloseTo(0);
    expect(centre.opacity).toBe(1);
  });

  it("tilts rows above and below the centre in opposite directions", () => {
    const above = wheelRowPose(-2);
    const below = wheelRowPose(2);

    expect(above.rotateX).toBeCloseTo(-below.rotateX);
    expect(above.translateY).toBeCloseTo(-below.translateY);
    expect(above.opacity).toBeCloseTo(below.opacity);
  });

  it("pulls curved rows towards the centre like a drum", () => {
    expect(wheelRowPose(2).translateY).toBeLessThan(0);
  });

  it("dims rows the further they turn away", () => {
    expect(wheelRowPose(1).opacity).toBeLessThan(1);
    expect(wheelRowPose(2).opacity).toBeLessThan(wheelRowPose(1).opacity);
  });

  it("hides rows that have turned past the top or bottom of the drum", () => {
    expect(wheelRowPose(6).opacity).toBe(0);
  });
});
