import type { TFunction } from "i18next";

import {
  achievementShowcase,
  focusSlices,
  headToHeadRows,
  headToHeadVerdict,
  identityTagLabel,
  parseProfileUserId,
  profilePictureUrl,
  translatedWeekday,
} from "../../../features/profile/friendProfilePresentation";

const echo = ((key: string, options?: { defaultValue?: string }) =>
  options?.defaultValue ?? key) as TFunction;

describe("friend profile presentation", () => {
  it("parses only positive profile ids", () => {
    expect(parseProfileUserId("12")).toBe(12);
    expect(parseProfileUserId(["7", "8"])).toBe(7);
    expect(parseProfileUserId("0")).toBeNull();
    expect(parseProfileUserId("invalid")).toBeNull();
  });

  it("normalizes relative and absolute profile image urls", () => {
    expect(profilePictureUrl("https://cdn.test/avatar.png")).toBe("https://cdn.test/avatar.png");
    expect(profilePictureUrl("/uploads/avatar.png")).toContain("/uploads/avatar.png");
    expect(profilePictureUrl("  ")).toBeNull();
  });

  it("uses translated weekdays and falls back to the server label", () => {
    const translated = ((key: string) => (key.endsWith("monday") ? "Montag" : key)) as TFunction;
    const fallback = ((key: string) => key) as TFunction;
    expect(translatedWeekday("Monday", translated)).toBe("Montag");
    expect(translatedWeekday("Studio Day", fallback)).toBe("Studio Day");
    expect(translatedWeekday(null, translated)).toBeNull();
  });

  it("falls back to a readable identity tag when no translation exists", () => {
    expect(identityTagLabel("building_momentum_fast", echo)).toBe("Building Momentum Fast");
  });
});

describe("head to head", () => {
  const you = { current_streak: 4, total_hours: 10, total_sessions: 20 };
  const them = { current_streak: 6, total_hours: 10, total_sessions: 12 };

  it("marks the leader of each metric", () => {
    expect(headToHeadRows(you, them).map((row) => [row.metric, row.leader])).toEqual([
      ["streak", "them"],
      ["hours", "tied"],
      ["sessions", "you"],
    ]);
  });

  it("calls a tie when both sides win equally often", () => {
    expect(headToHeadVerdict(headToHeadRows(you, them))).toBe("tied");
  });

  it("names the side that leads more metrics", () => {
    const ahead = { ...them, total_hours: 12 };
    expect(headToHeadVerdict(headToHeadRows(you, ahead))).toBe("them");
  });
});

describe("focus slices", () => {
  it("sorts by share and merges the long tail into one slice", () => {
    const slices = focusSlices({ mixing: 2, beat_making: 5, recording: 1, mastering: 1, learning: 1 }, 3);
    expect(slices.map((slice) => slice.type)).toEqual(["beat_making", "mixing", "other"]);
    expect(slices.map((slice) => slice.count)).toEqual([5, 2, 3]);
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1);
  });

  it("returns nothing when there are no sessions", () => {
    expect(focusSlices({})).toEqual([]);
    expect(focusSlices({ mixing: 0 })).toEqual([]);
  });
});

describe("achievement showcase", () => {
  it("lists unlocked achievements first, then the locked catalogue", () => {
    const items = achievementShowcase([{ id: "streak_7" }]);
    expect(items[0]).toEqual({ id: "streak_7", unlocked: true });
    expect(items.filter((item) => item.unlocked)).toHaveLength(1);
    expect(items.some((item) => item.id === "first_session" && !item.unlocked)).toBe(true);
  });

  it("keeps unlocked achievements the catalogue does not know yet", () => {
    const items = achievementShowcase([{ id: "future_badge" }]);
    expect(items[0]).toEqual({ id: "future_badge", unlocked: true });
  });
});
