import type { TFunction } from "i18next";

import type { InsightItemDto } from "../types/insights";

export function deriveFocusTier(score: number): string {
  if (score >= 95) return "excellent";
  if (score >= 80) return "strong";
  if (score >= 60) return "solid";
  return "room_to_improve";
}

export function buildFocusHeadline(score: number, tier: string, t: TFunction): string {
  const tierLabel = t(`sessionInsights.focusTier.${tier}`);
  return t("sessionInsights.focusHeadline", { score, tier: tierLabel });
}

export function translateInsightItem(item: InsightItemDto, t: TFunction): string {
  if (item.key === "prod_peak_pattern") {
    const wdIdx = Number(item.params.weekday ?? 0);
    const names = t("common.weekdaysFull", { returnObjects: true }) as string[];
    const weekday = names[wdIdx % 7] ?? String(wdIdx);
    const h = Number(item.params.hour ?? 0);
    const hEnd = (h + 3) % 24;
    const hourRange = `${h}:00–${hEnd}:00`;
    return t("sessionInsights.api.prod_peak_pattern", { weekday, hourRange });
  }
  return t(`sessionInsights.api.${item.key}`, item.params as Record<string, string | number>);
}
