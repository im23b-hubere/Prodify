import { isWeeklyRecapTeaserVisible } from "../../../features/friends/components/FriendsWeeklyRecapTeaser";

describe("isWeeklyRecapTeaserVisible", () => {
  it("shows all day Sunday", () => {
    expect(isWeeklyRecapTeaserVisible(new Date(2026, 6, 5, 10, 0))).toBe(true);
  });

  it("shows Saturday from 18:00", () => {
    expect(isWeeklyRecapTeaserVisible(new Date(2026, 6, 4, 18, 0))).toBe(true);
    expect(isWeeklyRecapTeaserVisible(new Date(2026, 6, 4, 17, 59))).toBe(false);
  });

  it("hides on weekdays before weekend window", () => {
    expect(isWeeklyRecapTeaserVisible(new Date(2026, 6, 1, 12, 0))).toBe(false);
  });
});
