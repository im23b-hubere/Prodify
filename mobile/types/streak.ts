export type StreakDayKind = "session" | "freeze" | "none";

export type StreakWeekDayDto = {
  date: string;
  label: string;
  state: StreakDayKind;
  is_today: boolean;
  is_future: boolean;
};

export type StreakCalendarWeekDto = {
  week_start: string;
  offset: number;
  days: StreakWeekDayDto[];
};

export type StreakOverviewDto = {
  current_streak: number;
  longest_streak: number;
  last_7_day_states: StreakDayKind[];
  last_7_day_labels: string[];
  calendar_weeks?: StreakCalendarWeekDto[];
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
