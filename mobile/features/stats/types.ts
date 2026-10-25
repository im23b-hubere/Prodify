/** What the activity calendar draws; friends' public stats carry only this. */
export type HeatmapCell = { date: string; seconds: number; intensity: number };

/** The producer's own day: `counted` drives the studio week, not the calendar. */
export type HeatmapDay = HeatmapCell & { counted: boolean };

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
  key: "week" | "30d" | "all";
  label: string;
  period: StatsPeriod;
};

export type StatsSummaryView = {
  hours: string;
  sessions: string;
  avgLength: string;
  consistencyPercent: number;
  consistencyActiveDays: number;
  consistencyTotalDays: number;
  delta: number | null;
};
