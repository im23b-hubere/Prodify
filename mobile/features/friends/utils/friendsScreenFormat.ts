import type { TFunction } from "i18next";

import { colors } from "../../../constants/theme";

export function rankColor(rank: number) {
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#d1d5db";
  if (rank === 3) return "#cd7f32";
  return colors.secondary;
}

export function formatDuration(sec: number, t: TFunction): string {
  const m = Math.floor(sec / 60);
  if (m < 1) return t("friendsScreen.durationUnderOne");
  if (m < 60) return t("friendsScreen.durationMin", { m });
  const h = Math.floor(m / 60);
  return t("friendsScreen.durationHours", { h, m: m % 60 });
}

export function challengeKindLabel(kind: string, t: TFunction): string {
  if (kind === "duel") return t("friendsScreen.challengeKindDuel");
  if (kind === "team") return t("friendsScreen.challengeKindTeam");
  if (kind === "group") return t("friendsScreen.challengeKindGroup");
  return kind;
}

export function challengeDaysLeft(weekStart: string, durationDays?: number): number | null {
  const start = new Date(weekStart);
  if (!Number.isFinite(start.getTime())) return null;
  const totalDays = Math.max(1, durationDays ?? 7);
  const end = new Date(start.getTime() + totalDays * 24 * 60 * 60 * 1000);
  const diffDays = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

function sessionTypeSlugToCamelKey(slug: string): string {
  return slug
    .split("_")
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

export function formatSessionTypeLabel(type: string, t: TFunction): string {
  const key = `sessionTypes.${sessionTypeSlugToCamelKey(type)}`;
  const label = t(key);
  if (label !== key) return label;
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatStreakStatusLabel(
  key: string | null | undefined,
  label: string | null | undefined,
  t: TFunction,
): string {
  const normalizedKey = (key ?? "").trim().toLowerCase();
  const normalizedLabel = (label ?? "").trim().toLowerCase();
  if (normalizedKey === "starting" || normalizedLabel === "starting") {
    return t("friendsScreen.streakStatusStarting");
  }
  if (label?.trim()) return label.trim();
  return t("friendsScreen.streakStatusDefault");
}
