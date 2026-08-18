import type { TFunction } from "i18next";

import type { WeeklyReviewDto } from "../../types/outcomes";
import type { SessionStatsDto } from "../../types/session";

export function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  try {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return "";
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, options)}`;
  } catch {
    return "";
  }
}

export function buildWeeklySharePayload(
  t: TFunction,
  review: WeeklyReviewDto | null,
  stats: SessionStatsDto | null,
  sessions: number,
  hours: string,
): { message: string; url?: string } {
  const lines = [
    t("weeklyRecap.shareHeadline"),
    t("weeklyRecap.sessionsHours", { sessions, hours }),
  ];
  const summary = stats?.summary;
  if (summary) {
    lines.push(
      t("weeklyRecap.streakBest", {
        current: summary.current_streak_days,
        best: summary.best_streak_days,
      }),
    );
  }
  if (review?.insights?.length) {
    lines.push("", t("weeklyRecap.shareInsightsIntro"));
    lines.push(...review.insights.slice(0, 3).map((item) => `• ${item}`));
  }
  if (review?.ai_feedback?.trim()) lines.push("", review.ai_feedback.trim());
  const message = lines.join("\n").trim();
  const url =
    review?.share_image_url && /^https?:\/\//i.test(review.share_image_url)
      ? review.share_image_url
      : undefined;
  return { message: message || t("weeklyRecap.shareFallback", { sessions, hours }), url };
}
