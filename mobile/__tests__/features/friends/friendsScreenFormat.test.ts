import {
  challengeDaysLeft,
  challengeKindLabel,
  formatDuration,
  formatSessionTypeLabel,
  formatStreakStatusLabel,
  rankColor,
} from "../../../features/friends/utils/friendsScreenFormat";
import { mockTFunction } from "../../helpers/mockTFunction";

const mockT = mockTFunction((key, opts) => {
  if (opts) return `${key}:${JSON.stringify(opts)}`;
  return key;
});

describe("friendsScreenFormat", () => {
  it("maps rank colors for podium tiers", () => {
    expect(rankColor(1)).toBe("#fbbf24");
    expect(rankColor(2)).toBe("#d1d5db");
    expect(rankColor(3)).toBe("#cd7f32");
  });

  it("formats session durations", () => {
    expect(formatDuration(30, mockT)).toBe("friendsScreen.durationUnderOne");
    expect(formatDuration(90, mockT)).toContain("friendsScreen.durationMin");
  });

  it("labels challenge kinds", () => {
    expect(challengeKindLabel("duel", mockT)).toBe("friendsScreen.challengeKindDuel");
  });

  it("computes challenge days left from week start", () => {
    const futureStart = new Date();
    futureStart.setDate(futureStart.getDate() - 2);
    const daysLeft = challengeDaysLeft(futureStart.toISOString().slice(0, 10), 7);
    expect(daysLeft).toBeGreaterThan(0);
    expect(daysLeft).toBeLessThanOrEqual(7);
  });

  it("formats streak status starting key", () => {
    expect(formatStreakStatusLabel("starting", null, mockT)).toBe(
      "friendsScreen.streakStatusStarting",
    );
  });

  it("falls back to title-cased session type slug", () => {
    expect(formatSessionTypeLabel("beat_making", mockT)).toMatch(/beat/i);
  });
});
