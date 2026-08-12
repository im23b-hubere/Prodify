import type { TFunction } from "i18next";

import type { StreakOverviewDto } from "../../../types/streak";
import { useDashboardMilestoneEvents } from "./useDashboardMilestoneEvents";
import { useDashboardStreakBreakEvent } from "./useDashboardStreakBreakEvent";

type Params = {
  userId?: number;
  streakOverview: StreakOverviewDto | null;
  userScopedMilestoneKey: string;
  userScopedStreakKey: string;
  t: TFunction;
  refreshUnread: () => void;
};

export function useDashboardStreakEvents({
  userId,
  streakOverview,
  userScopedMilestoneKey,
  userScopedStreakKey,
  t,
  refreshUnread,
}: Params) {
  const milestoneToast = useDashboardMilestoneEvents({
    userId,
    streakOverview,
    storageKey: userScopedMilestoneKey,
    t,
    refreshUnread,
  });
  const streakBreak = useDashboardStreakBreakEvent({
    userId,
    streakOverview,
    storageKey: userScopedStreakKey,
  });

  return {
    milestoneToast,
    breakModalOpen: streakBreak.isOpen,
    breakModalStreak: streakBreak.previousStreak,
    dismissBreakModal: streakBreak.dismiss,
  };
}
