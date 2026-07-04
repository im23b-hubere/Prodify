import { nextSundayRecapFireDate } from "../../lib/weeklyRecapNotifications";

describe("nextSundayRecapFireDate", () => {
  it("returns same-day 19:00 when called before Sunday evening", () => {
    const from = new Date("2026-07-05T10:00:00"); // Sunday
    const fire = nextSundayRecapFireDate(from);
    expect(fire.getDay()).toBe(0);
    expect(fire.getHours()).toBe(19);
    expect(fire.getMinutes()).toBe(0);
    expect(fire.getDate()).toBe(5);
  });

  it("rolls to next Sunday when Sunday evening already passed", () => {
    const from = new Date("2026-07-05T21:00:00"); // Sunday after 19:00
    const fire = nextSundayRecapFireDate(from);
    expect(fire.getDay()).toBe(0);
    expect(fire.getDate()).toBe(12);
    expect(fire.getHours()).toBe(19);
  });

  it("targets upcoming Sunday from mid-week", () => {
    const from = new Date("2026-07-08T12:00:00"); // Wednesday
    const fire = nextSundayRecapFireDate(from);
    expect(fire.getDay()).toBe(0);
    expect(fire.getDate()).toBe(12);
    expect(fire.getHours()).toBe(19);
  });
});
