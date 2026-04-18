export type StreakOverviewDto = {
  current_streak: number;
  longest_streak: number;
  last_7_day_states: ("session" | "freeze" | "none")[];
  last_7_day_labels: string[];
  next_milestone_at: number | null;
  next_milestone_title: string | null;
  days_to_next_milestone: number | null;
  freezes_remaining: number;
  can_use_freeze: boolean;
  streak_at_risk: boolean;
  tagline: string;
};

export type StreakFreezeResultDto = {
  success: boolean;
  message: string;
  current_streak: number;
  freezes_remaining: number;
};

export type StreakRunDto = {
  start_date: string;
  end_date: string;
  length_days: number;
};

export type StreakMilestoneItemDto = {
  days: number;
  title: string;
  unlocked: boolean;
};

export type StreakMilestonesDto = {
  milestones: StreakMilestoneItemDto[];
  longest_streak_days: number;
};
