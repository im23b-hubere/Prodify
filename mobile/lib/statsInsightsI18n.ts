import type { TFunction } from "i18next";

import type { InsightItemDto } from "../types/insights";

/** Tip items from `GET /stats/insights` → `productivity.tip_items`. */
export function translateStatsInsightItem(item: InsightItemDto, t: TFunction): string {
  if (item.key === "stats_insights_best_hour") {
    const h = Number(item.params.hour ?? 0);
    const hEnd = (h + 1) % 24;
    const hourRange = `${h}:00–${hEnd}:00`;
    return t("statsInsights.api.stats_insights_best_hour", { hourRange });
  }
  if (item.key === "stats_insights_lean_dow") {
    const wdIdx = Number(item.params.weekday ?? 0);
    const names = t("common.weekdaysFull", { returnObjects: true }) as string[];
    const weekday = names[wdIdx % 7] ?? String(wdIdx);
    return t("statsInsights.api.stats_insights_lean_dow", { weekday });
  }
  return t(`statsInsights.api.${item.key}`, item.params as Record<string, string | number>);
}
