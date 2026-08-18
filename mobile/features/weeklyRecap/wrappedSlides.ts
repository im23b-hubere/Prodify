import type { TFunction } from "i18next";

import { sessionTypeLabel } from "../../lib/sessionI18n";
import type { SessionStatsDto } from "../../types/session";
import type { WeeklyReviewDto } from "../../types/outcomes";

export type WrappedSlideKind = "intro" | "stat" | "label" | "quote" | "outro" | "empty" | "signin";

export type WrappedSlide = {
  id: string;
  kind: WrappedSlideKind;
  colors: [string, string, string];
  kicker?: string;
  title: string;
  subtitle?: string;
  footnote?: string;
};

type BuildArgs = {
  t: TFunction;
  review: WeeklyReviewDto | null;
  stats: SessionStatsDto | null;
  displaySessions: number;
  displayHours: string;
  weekRange: string;
};

type StatSlideArgs = Pick<BuildArgs, "t" | "stats" | "displaySessions" | "displayHours">;

function wrappedLabelTitle(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= 20) {
    return trimmed.replace(/ /g, "\u00A0");
  }
  return trimmed;
}

export function buildWrappedSlides({
  t,
  review,
  stats,
  displaySessions,
  displayHours,
  weekRange,
}: BuildArgs): WrappedSlide[] {
  const slides: WrappedSlide[] = [
    {
      id: "intro",
      kind: "intro",
      colors: ["#1a0a2e", "#4a148c", "#07070a"],
      kicker: t("weeklyRecap.wrappedIntroKicker"),
      title: t("weeklyRecap.wrappedIntroTitle"),
      subtitle: weekRange || t("weeklyRecap.wrappedIntroFallback"),
      footnote: t("brand"),
    },
  ];

  if (displaySessions <= 0 && !stats?.summary) {
    slides.push({
      id: "empty",
      kind: "empty",
      colors: ["#141414", "#1f1f1f", "#0a0a0a"],
      kicker: t("weeklyRecap.wrappedEmptyKicker"),
      title: t("weeklyRecap.emptyTitle"),
      subtitle: t("weeklyRecap.emptyBody"),
    });
    slides.push(buildOutroSlide(t, displaySessions, displayHours));
    return slides;
  }
  slides.push(...buildStatSlides({ t, stats, displaySessions, displayHours }));
  const deltaSlide = buildDeltaSlide(t, stats);
  if (deltaSlide) slides.push(deltaSlide);
  const topTypeSlide = buildTopTypeSlide(t, stats);
  if (topTypeSlide) slides.push(topTypeSlide);
  slides.push(...buildNarrativeSlides(t, review));
  slides.push(buildOutroSlide(t, displaySessions, displayHours));
  return slides;
}

function buildStatSlides({
  t,
  stats,
  displaySessions,
  displayHours,
}: StatSlideArgs): WrappedSlide[] {
  const summary = stats?.summary;
  return [
    {
      id: "sessions",
      kind: "stat",
      colors: ["#ff3d00", "#ff6a3d", "#2a0f08"],
      kicker: t("weeklyRecap.wrappedSessionsKicker"),
      title: String(displaySessions),
      subtitle: t("weeklyRecap.kpiSessions"),
      footnote: t("weeklyRecap.wrappedSessionsFoot", { count: displaySessions }),
    },
    {
      id: "hours",
      kind: "stat",
      colors: ["#0a2e22", "#00ff88", "#061510"],
      kicker: t("weeklyRecap.wrappedHoursKicker"),
      title: `${displayHours}h`,
      subtitle: t("weeklyRecap.kpiHours"),
      footnote: t("weeklyRecap.wrappedHoursFoot", { hours: displayHours }),
    },
    {
      id: "streak",
      kind: "stat",
      colors: ["#3d1510", "#ff3d00", "#120808"],
      kicker: t("weeklyRecap.wrappedStreakKicker"),
      title: String(summary?.current_streak_days ?? 0),
      subtitle: t("weeklyRecap.kpiCurrentStreak"),
      footnote: t("weeklyRecap.streakBest", {
        current: summary?.current_streak_days ?? 0,
        best: summary?.best_streak_days ?? 0,
      }),
    },
  ];
}

function buildDeltaSlide(t: TFunction, stats: SessionStatsDto | null): WrappedSlide | null {
  const delta = stats?.summary.hours_delta_vs_prior_period;
  if (delta == null) return null;
  return {
    id: "delta",
    kind: "stat",
    colors: ["#16213e", "#a259ff", "#0a0818"],
    kicker: t("weeklyRecap.wrappedDeltaKicker"),
    title: `${delta >= 0 ? "+" : ""}${delta}h`,
    subtitle: t("weeklyRecap.vsPriorShort"),
    footnote: t("weeklyRecap.vsPrior", {
      sign: delta >= 0 ? "+" : "",
      hours: delta,
    }),
  };
}

function buildTopTypeSlide(t: TFunction, stats: SessionStatsDto | null): WrappedSlide | null {
  const topBreakdown = [...(stats?.breakdown ?? [])].sort((a, b) => b.sessions - a.sessions)[0];
  if (!topBreakdown || topBreakdown.sessions <= 0) return null;
  return {
    id: "top-type",
    kind: "label",
    colors: ["#2d1b4e", "#a259ff", "#100818"],
    kicker: t("weeklyRecap.wrappedTopTypeKicker"),
    title: wrappedLabelTitle(sessionTypeLabel(String(topBreakdown.session_type), t)),
    subtitle: t("weeklyRecap.wrappedTopTypeSubtitle"),
    footnote: t("weeklyRecap.wrappedTopTypeFoot", {
      percent: topBreakdown.percent,
      sessions: topBreakdown.sessions,
    }),
  };
}

function buildNarrativeSlides(t: TFunction, review: WeeklyReviewDto | null): WrappedSlide[] {
  const insights = (review?.insights ?? []).slice(0, 3).map(
    (insight, index): WrappedSlide => ({
      id: `insight-${index}`,
      kind: "quote",
      colors: ["#1a1030", "#5b21b6", "#0a0612"],
      kicker: t("weeklyRecap.wrappedInsightKicker"),
      title: insight,
      subtitle: t("weeklyRecap.sections.insights"),
    }),
  );
  const blockers = (review?.blockers ?? []).slice(0, 2).map(
    (blocker, index): WrappedSlide => ({
      id: `blocker-${index}`,
      kind: "quote",
      colors: ["#2a1010", "#7f1d1d", "#0a0505"],
      kicker: t("weeklyRecap.wrappedBlockerKicker"),
      title: blocker,
      subtitle: t("weeklyRecap.sections.blockers"),
    }),
  );
  const suggestions = (review?.suggestions ?? []).slice(0, 2).map(
    (suggestion, index): WrappedSlide => ({
      id: `suggestion-${index}`,
      kind: "quote",
      colors: ["#102a1a", "#059669", "#060f0a"],
      kicker: t("weeklyRecap.wrappedNextKicker"),
      title: suggestion,
      subtitle: t("weeklyRecap.sections.nextWeek"),
    }),
  );
  const feedback = review?.ai_feedback?.trim();
  const aiFeedback: WrappedSlide[] = feedback
    ? [
        {
          id: "ai-feedback",
          kind: "quote",
          colors: ["#1a1030", "#a259ff", "#0c0818"],
          kicker: t("weeklyRecap.wrappedAiKicker"),
          title: feedback,
          subtitle: t("weeklyRecap.weeklyInsightLabel"),
        },
      ]
    : [];
  return [...insights, ...blockers, ...suggestions, ...aiFeedback];
}

function buildOutroSlide(
  t: TFunction,
  displaySessions: number,
  displayHours: string,
): WrappedSlide {
  return {
    id: "outro",
    kind: "outro",
    colors: ["#3d1510", "#1a1010", "#0a0a0a"],
    kicker: t("weeklyRecap.wrappedOutroKicker"),
    title: t("weeklyRecap.wrappedOutroTitle"),
    subtitle: t("weeklyRecap.sessionsHours", {
      sessions: displaySessions,
      hours: displayHours,
    }),
    footnote: t("weeklyRecap.wrappedShareHint"),
  };
}
