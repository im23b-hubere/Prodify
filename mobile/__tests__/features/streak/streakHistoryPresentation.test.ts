import {
  formatStreakRange,
  isActiveStreakRun,
  utcCalendarDateIso,
} from "../../../features/streak/streakHistoryPresentation";

const NOW = new Date("2026-08-10T00:15:00Z");

describe("streak history presentation", () => {
  it("derives UTC calendar days without local-time drift", () => {
    expect(utcCalendarDateIso(0, NOW)).toBe("2026-08-10");
    expect(utcCalendarDateIso(-1, NOW)).toBe("2026-08-09");
  });

  it("marks only the leading current or yesterday-ending run as active", () => {
    const currentRun = { start_date: "2026-08-05", end_date: "2026-08-10", length_days: 6 };
    const yesterdayRun = { ...currentRun, end_date: "2026-08-09" };

    expect(isActiveStreakRun(currentRun, 0, 6, NOW)).toBe(true);
    expect(isActiveStreakRun(yesterdayRun, 0, 6, NOW)).toBe(true);
    expect(isActiveStreakRun(currentRun, 1, 6, NOW)).toBe(false);
    expect(isActiveStreakRun(currentRun, 0, 5, NOW)).toBe(false);
  });

  it("formats one-day and ranged runs", () => {
    const single = formatStreakRange("2026-08-10", "2026-08-10", "en-US");
    const range = formatStreakRange("2026-08-09", "2026-08-10", "en-US");

    expect(single).toBe("Aug 10, 2026");
    expect(range).toBe("Aug 9, 2026 → Aug 10, 2026");
  });
});
