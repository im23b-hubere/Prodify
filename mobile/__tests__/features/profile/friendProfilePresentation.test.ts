import type { TFunction } from "i18next";

import {
  parseProfileUserId,
  profilePictureUrl,
  translatedWeekday,
} from "../../../features/profile/friendProfilePresentation";

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
});
