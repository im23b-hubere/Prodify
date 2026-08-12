import type { TFunction } from "i18next";
import { useMemo } from "react";

import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { translateInsightItem } from "../../../lib/sessionInsightsI18n";
import type { SessionStatsDto } from "../../../types/session";
import { STATS_BREAKDOWN_COLORS } from "../constants";
import type { PersonalRecord, StatsFilter, StatsPeriod } from "../types";
import { buildChartData, buildStatsSummary } from "../utils/chartData";
import { decorateRecords } from "../utils/records";

export function useStatsFilters(t: TFunction, filterIndex: number) {
  const filters = useMemo<readonly StatsFilter[]>(
    () => [
      { key: "7d", label: t("stats.filter7d"), period: "week" },
      { key: "30d", label: t("stats.filter30d"), period: "month" },
      { key: "all", label: t("stats.filterAll"), period: "all" },
    ],
    [t],
  );
  const filter = filters[filterIndex] ?? filters[0];
  return { filters, filter, periodParam: filter.period };
}

export function useStatsPresentation(
  stats: SessionStatsDto | null,
  records: PersonalRecord[],
  period: StatsPeriod,
  t: TFunction,
) {
  const summary = useMemo(() => buildStatsSummary(stats), [stats]);
  const chartData = useMemo(() => buildChartData(stats, period), [period, stats]);
  const breakdownData = useMemo(
    () =>
      (stats?.breakdown ?? []).map((item, index) => ({
        label: sessionTypeLabel(String(item.session_type), t),
        value: Math.max(0, Math.round(item.percent)),
        sessions: item.sessions,
        color: STATS_BREAKDOWN_COLORS[index % STATS_BREAKDOWN_COLORS.length],
      })),
    [stats, t],
  );
  const decoratedRecords = useMemo(() => decorateRecords(records), [records]);
  const productivityHintText = useMemo(() => {
    if (stats?.productivity_hint_item) {
      return translateInsightItem(stats.productivity_hint_item, t);
    }
    return stats?.productivity_hint ?? null;
  }, [stats?.productivity_hint_item, stats?.productivity_hint, t]);

  return {
    summary,
    chartData,
    breakdownData,
    decoratedRecords,
    productivityHintText,
    recentSessions: stats?.recent_sessions ?? [],
  };
}
