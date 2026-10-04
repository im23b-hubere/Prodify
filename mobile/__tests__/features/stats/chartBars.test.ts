import {
  barFillScale,
  chartBarTone,
  liveChartLabel,
  todayBarGrowth,
} from "../../../features/stats/utils/chartBars";
import { localDateKey, startOfWeekMonday } from "../../../lib/weekCalendar";

describe("liveChartLabel", () => {
  const wednesday = new Date(2026, 0, 7, 15, 0, 0);

  it("marks the local calendar day in week and month views", () => {
    expect(liveChartLabel("week", wednesday)).toBe("2026-01-07");
    expect(liveChartLabel("month", wednesday)).toBe("2026-01-07");
  });

  it("marks this week's Monday on the lifetime chart so the current bucket can grow", () => {
    expect(liveChartLabel("all", wednesday)).toBe(localDateKey(startOfWeekMonday(wednesday)));
    expect(liveChartLabel("all", wednesday)).toBe("2026-01-05");
  });
});

describe("chartBarTone", () => {
  it("keeps today alive even before hours land, and leaves empty days quiet", () => {
    expect(chartBarTone(true, 0)).toBe("today");
    expect(chartBarTone(true, 1.5)).toBe("today");
    expect(chartBarTone(false, 2)).toBe("active");
    expect(chartBarTone(false, 0)).toBe("empty");
  });
});

describe("todayBarGrowth", () => {
  it("grows only after we already showed a shorter today bar", () => {
    expect(todayBarGrowth(null, 1.5)).toBeNull();
    expect(todayBarGrowth(1.5, 1.5)).toBeNull();
    expect(todayBarGrowth(2, 1)).toBeNull();
    expect(todayBarGrowth(0, 1.5)).toEqual({ fromHours: 0, toHours: 1.5 });
    expect(todayBarGrowth(1.5, 2)).toEqual({ fromHours: 1.5, toHours: 2 });
  });
});

describe("barFillScale", () => {
  it("maps hours onto the tallest bar without a fake stub for empty days", () => {
    expect(barFillScale(0, 3)).toBe(0);
    expect(barFillScale(1.5, 3)).toBe(0.5);
    expect(barFillScale(3, 3)).toBe(1);
    expect(barFillScale(1, 0)).toBe(0);
  });
});
