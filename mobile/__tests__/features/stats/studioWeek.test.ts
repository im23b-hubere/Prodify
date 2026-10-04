import { MINIMUM_COUNTED_SESSION_SECONDS } from "../../../features/sessions/sessionCompletePresentation";
import {
  countedStudioDayKeys,
  studioWeekFill,
  uncelebratedFullWeekStart,
} from "../../../features/stats/utils/studioWeek";
import { weekDateKeys } from "../../../lib/weekCalendar";

const wednesday = new Date(2026, 0, 7, 15, 0, 0);
const thisWeek = weekDateKeys(0, wednesday);

function day(date: string, seconds: number) {
  return { date, seconds, intensity: seconds > 0 ? 2 : 0 };
}

describe("countedStudioDayKeys", () => {
  it("fills a day only after the same five-minute floor as XP and challenges", () => {
    expect([
      ...countedStudioDayKeys([
        day("2026-01-05", MINIMUM_COUNTED_SESSION_SECONDS - 1),
        day("2026-01-06", MINIMUM_COUNTED_SESSION_SECONDS),
        day("2026-01-07", 0),
      ]),
    ]).toEqual(["2026-01-06"]);
  });
});

describe("studioWeekFill", () => {
  it("counts only this week's counted days and completes at seven", () => {
    const six = thisWeek.slice(0, 6).map((date) => day(date, 600));
    expect(studioWeekFill(six, thisWeek)).toEqual({
      filledCount: 6,
      isComplete: false,
      filledKeys: new Set(thisWeek.slice(0, 6)),
    });

    const seven = thisWeek.map((date) => day(date, 600));
    expect(studioWeekFill(seven, thisWeek).isComplete).toBe(true);
    expect(studioWeekFill(seven, thisWeek).filledCount).toBe(7);
  });
});

describe("uncelebratedFullWeekStart", () => {
  it("waits for storage so a reopen cannot fire a second haptic", () => {
    const seven = thisWeek.map((date) => day(date, 600));
    expect(
      uncelebratedFullWeekStart(seven, null, false, wednesday),
    ).toBeNull();
  });

  it("celebrates this week once, then stays quiet", () => {
    const seven = thisWeek.map((date) => day(date, 600));
    expect(uncelebratedFullWeekStart(seven, null, true, wednesday)).toBe(thisWeek[0]);
    expect(uncelebratedFullWeekStart(seven, thisWeek[0], true, wednesday)).toBeNull();
  });

  it("still celebrates last week on Monday if Stats was not opened on Sunday", () => {
    const monday = new Date(2026, 0, 12, 9, 0, 0);
    const last = weekDateKeys(-1, monday);
    const days = last.map((date) => day(date, 600));
    expect(uncelebratedFullWeekStart(days, null, true, monday)).toBe(last[0]);
    expect(uncelebratedFullWeekStart(days, last[0], true, monday)).toBeNull();
  });

  it("does not celebrate an incomplete week", () => {
    const days = thisWeek.slice(0, 5).map((date) => day(date, 600));
    expect(uncelebratedFullWeekStart(days, null, true, wednesday)).toBeNull();
  });
});
