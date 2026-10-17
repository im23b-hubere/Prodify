import type { TFunction } from "i18next";

import {
  STREAK_MILESTONES,
  formatStreakMilestoneMessage,
  latestNewMilestone,
  streakMilestoneTitle,
} from "../../lib/streakMilestones";

const t = ((key: string) => `t:${key}`) as TFunction;

describe("STREAK_MILESTONES", () => {
  it("stores i18n keys instead of English display copy", () => {
    for (const milestone of STREAK_MILESTONES) {
      expect(milestone.titleKey).toMatch(/^streakMilestones\.d\d+\.title$/);
      expect(milestone.rewardKey).toMatch(/^streakMilestones\.d\d+\.reward$/);
      expect(milestone).not.toHaveProperty("title");
      expect(milestone).not.toHaveProperty("reward");
    }
  });

  it("resolves title and toast message through t()", () => {
    const milestone = latestNewMilestone(7, 0);
    expect(milestone?.days).toBe(7);
    expect(streakMilestoneTitle(milestone!, t)).toBe("t:streakMilestones.d7.title");
    expect(formatStreakMilestoneMessage(milestone!, t)).toBe(
      "t:streakMilestones.message",
    );
  });
});
