import type { TFunction } from "i18next";

import { API_BASE_URL } from "../../constants/api";

export function parseProfileUserId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const userId = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

export function profilePictureUrl(path: string | null | undefined): string | null {
  const normalized = path?.trim();
  if (!normalized) return null;
  return normalized.startsWith("http") ? normalized : `${API_BASE_URL}${normalized}`;
}

export function profileInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}

export function identityTagLabel(tag: string, t: TFunction): string {
  const readable = tag
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
  return t(`friendProfile.identityTags.${tag}`, { defaultValue: readable });
}

export function translatedWeekday(day: string | null | undefined, t: TFunction): string | null {
  if (!day?.trim()) return null;
  const normalized = day.trim();
  const key = `friendProfile.weekdays.${normalized.toLowerCase()}`;
  const translated = t(key, { defaultValue: "" });
  return translated && translated !== key ? translated : normalized;
}

const memberSinceFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});

export function memberSinceDate(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  return Number.isFinite(date.getTime()) ? memberSinceFormatter.format(date) : null;
}

export type ComparableStats = {
  current_streak: number;
  total_hours: number;
  total_sessions: number;
};

export type HeadToHeadSide = "you" | "them" | "tied";
export type HeadToHeadMetric = "streak" | "hours" | "sessions";

export type HeadToHeadRow = {
  metric: HeadToHeadMetric;
  yours: number;
  theirs: number;
  leader: HeadToHeadSide;
};

function leaderOf(yours: number, theirs: number): HeadToHeadSide {
  if (yours === theirs) return "tied";
  return yours > theirs ? "you" : "them";
}

function compareRow(metric: HeadToHeadMetric, yours: number, theirs: number): HeadToHeadRow {
  return { metric, yours, theirs, leader: leaderOf(yours, theirs) };
}

export function headToHeadRows(you: ComparableStats, them: ComparableStats): HeadToHeadRow[] {
  return [
    compareRow("streak", you.current_streak, them.current_streak),
    compareRow("hours", you.total_hours, them.total_hours),
    compareRow("sessions", you.total_sessions, them.total_sessions),
  ];
}

export function headToHeadVerdict(rows: HeadToHeadRow[]): HeadToHeadSide {
  const yourWins = rows.filter((row) => row.leader === "you").length;
  const theirWins = rows.filter((row) => row.leader === "them").length;
  return leaderOf(yourWins, theirWins);
}

export type FocusSlice = { type: string; count: number; share: number };

export const OTHER_FOCUS_TYPE = "other";

/** Session types ordered by count; everything past `limit - 1` is merged into one "other" slice. */
export function focusSlices(breakdown: Record<string, number>, limit = 4): FocusSlice[] {
  const entries = Object.entries(breakdown)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return [];
  const visible = entries.length > limit ? entries.slice(0, limit - 1) : entries;
  const restCount = entries.slice(visible.length).reduce((sum, [, count]) => sum + count, 0);
  const slices = visible.map(([type, count]) => ({ type, count, share: count / total }));
  if (restCount === 0) return slices;
  return [...slices, { type: OTHER_FOCUS_TYPE, count: restCount, share: restCount / total }];
}

const ACHIEVEMENT_CATALOGUE = [
  "first_session",
  "sessions_10",
  "streak_7",
  "marathon_2h",
  "night_owl",
  "sessions_50",
] as const;

export type AchievementShowcaseItem = { id: string; unlocked: boolean };

export function achievementShowcase(unlocked: { id: string }[]): AchievementShowcaseItem[] {
  const unlockedIds = new Set(unlocked.map((achievement) => achievement.id));
  const locked = ACHIEVEMENT_CATALOGUE.filter((id) => !unlockedIds.has(id));
  return [
    ...[...unlockedIds].map((id) => ({ id, unlocked: true })),
    ...locked.map((id) => ({ id, unlocked: false })),
  ];
}
