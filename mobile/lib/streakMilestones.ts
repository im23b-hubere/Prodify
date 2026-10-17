import type { TFunction } from "i18next";

export type StreakMilestone = {
  days: number;
  titleKey: string;
  rewardKey: string;
};

export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, titleKey: "streakMilestones.d3.title", rewardKey: "streakMilestones.d3.reward" },
  { days: 7, titleKey: "streakMilestones.d7.title", rewardKey: "streakMilestones.d7.reward" },
  { days: 14, titleKey: "streakMilestones.d14.title", rewardKey: "streakMilestones.d14.reward" },
  { days: 30, titleKey: "streakMilestones.d30.title", rewardKey: "streakMilestones.d30.reward" },
  { days: 60, titleKey: "streakMilestones.d60.title", rewardKey: "streakMilestones.d60.reward" },
  { days: 100, titleKey: "streakMilestones.d100.title", rewardKey: "streakMilestones.d100.reward" },
];

export function latestNewMilestone(currentStreak: number, highestSeenStreak: number) {
  const newlyPassed = STREAK_MILESTONES.filter(
    (milestone) => currentStreak >= milestone.days && milestone.days > highestSeenStreak,
  );
  return newlyPassed[newlyPassed.length - 1] ?? null;
}

export function streakMilestoneTitle(milestone: StreakMilestone, t: TFunction): string {
  return t(milestone.titleKey);
}

export function formatStreakMilestoneMessage(milestone: StreakMilestone, t: TFunction): string {
  return t("streakMilestones.message", {
    title: t(milestone.titleKey),
    reward: t(milestone.rewardKey),
  });
}
