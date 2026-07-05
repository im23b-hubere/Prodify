export type HeatmapDay = { date: string; seconds: number; intensity: number };

export type PersonalRecord = {
  key: string;
  label: string;
  value: string;
  context: string | null;
  occurred_at: string | null;
};

export type DecoratedRecord = PersonalRecord & { score: number; isFresh: boolean };

export type BarPoint = { x: string; y: number; label: string };

export type StatsPeriod = "week" | "month" | "all";

export type StatsFilter = {
  key: "7d" | "30d" | "all";
  label: string;
  period: StatsPeriod;
};

export type StatsSummaryView = {
  hours: string;
  sessions: string;
  avgSession: string;
  streak: number;
  bestStreak: number;
  delta: number | null;
};
