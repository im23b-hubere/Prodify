import type { TFunction } from "i18next";
import { useMemo } from "react";

import type { SessionStatsDto } from "../../../types/session";
import type { PersonalRecord, StatsFilter, StatsPeriod } from "../types";
import { buildChartData, buildStatsSummary } from "../utils/chartData";
import { chartRecordMarks } from "../utils/chartRecords";
import { decorateRecords } from "../utils/records";
import { buildWoranRows } from "../utils/woran";

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
  const summary = useMemo(() => buildStatsSummary(stats, period), [period, stats]);
  const chartData = useMemo(() => buildChartData(stats, period), [period, stats]);
  const woranRows = useMemo(() => buildWoranRows(stats?.branch_seconds, t), [stats, t]);
  const decoratedRecords = useMemo(() => decorateRecords(records), [records]);
  const recordMarks = useMemo(
    () => chartRecordMarks(chartData, decoratedRecords, period),
    [chartData, decoratedRecords, period],
  );

  return {
    summary,
    chartData,
    recordMarks,
    woranRows,
    decoratedRecords,
    recentSessions: stats?.recent_sessions ?? [],
  };
}
