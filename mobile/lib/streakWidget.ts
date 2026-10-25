import type { StreakOverviewDto } from "../types/streak";
import { apiJson } from "./client";
import i18n from "./i18n";
import { weekdayShortLabels } from "./streakCalendarWeeks";
import { buildStreakWidgetTimeline, type StreakWidgetCopy } from "./streakWidgetTimeline";
import { canUseWidgetExtension } from "./widgetExtension";

type StreakWidgetModule = typeof import("../widgets/StreakWidget");

let streakWidget: StreakWidgetModule["default"] | null | undefined;

/**
 * Re-plans the home and lock screen streak widget. Pass null after sign-out so the previous
 * account's streak does not linger on the home screen.
 */
export function syncStreakWidget(overview: StreakOverviewDto | null): void {
  loadStreakWidget()?.updateTimeline(buildStreakWidgetTimeline(overview, streakWidgetCopy()));
}

/**
 * Fetches the streak and re-plans the widget, so a finished session flips it to "secured" even
 * when the app closes before the dashboard reloads.
 */
export async function refreshStreakWidget(token: string): Promise<void> {
  if (!loadStreakWidget()) return;
  syncStreakWidget(await apiJson<StreakOverviewDto>("/streak/overview", { token }));
}

function loadStreakWidget(): StreakWidgetModule["default"] | null {
  if (streakWidget !== undefined) return streakWidget;
  if (!canUseWidgetExtension()) {
    streakWidget = null;
    return streakWidget;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    streakWidget = (require("../widgets/StreakWidget") as StreakWidgetModule).default;
  } catch {
    streakWidget = null;
  }
  return streakWidget;
}

function streakWidgetCopy(): StreakWidgetCopy {
  return {
    headline: (mood) => i18n.t(`streakWidget.${mood}`),
    streakLabel: i18n.t("streakHero.dayStreak"),
    weekdayLabels: weekdayShortLabels(i18n.t),
    accessibilityLabel: (streak, headline) =>
      `${i18n.t("shareCard.dayStreak", { count: streak })}. ${headline}`,
  };
}
