import {
  addDaysIso,
  CALENDAR_WEEK_COUNT,
  currentWeekDateKeys,
  formatWeekRangeLabel,
  startOfWeekMonday,
  weekDateKeys,
} from "../../lib/weekCalendar";

describe("weekCalendar", () => {
  const wednesday = new Date(2026, 8, 2, 12, 0, 0);

  it("starts the week on Monday", () => {
    const monday = startOfWeekMonday(wednesday);
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(7);
    expect(monday.getDate()).toBe(31);
  });

  it("returns seven Monday–Sunday keys for the current week", () => {
    expect(weekDateKeys(0, wednesday)).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
    expect(currentWeekDateKeys(wednesday)).toEqual(weekDateKeys(0, wednesday));
  });

  it("shifts previous weeks by seven days", () => {
    expect(weekDateKeys(-1, wednesday)[0]).toBe("2026-08-24");
    expect(weekDateKeys(-1, wednesday)[6]).toBe("2026-08-30");
  });

  it("formats a week range and keeps a four-week pager window", () => {
    expect(CALENDAR_WEEK_COUNT).toBe(4);
    expect(addDaysIso("2026-08-31", 6)).toBe("2026-09-06");
    expect(formatWeekRangeLabel("2026-08-31", "en-US")).toMatch(/Aug 31/);
    expect(formatWeekRangeLabel("2026-08-31", "en-US")).toMatch(/Sep 6/);
  });
});
