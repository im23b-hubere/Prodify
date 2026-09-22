import { useMemo } from "react";

import { StatsKpiStrip, type KpiItem } from "../../../components/stats/StatsKpiStrip";
import type { StatsScreenController } from "../hooks/useStatsScreenController";

export function StatsKpiBlock({ controller }: { controller: StatsScreenController }) {
  const { t, summary } = controller;
  const items = useMemo<KpiItem[]>(
    () => [
      {
        key: "hours",
        label: t("stats.totalHours"),
        value: summary.hours,
        sublabel:
          summary.delta == null
            ? undefined
            : t("stats.vsPrior", { sign: summary.delta >= 0 ? "+" : "", hours: summary.delta }),
        subPositive: summary.delta == null ? undefined : summary.delta >= 0,
      },
      {
        key: "avg",
        label: t("stats.avgSession"),
        value: summary.avgLength,
      },
      {
        key: "consistency",
        label: t("stats.consistency"),
        value: `${summary.consistencyPercent}%`,
        sublabel:
          summary.consistencyTotalDays > 0
            ? t("stats.consistencySub", {
                active: summary.consistencyActiveDays,
                total: summary.consistencyTotalDays,
              })
            : undefined,
      },
    ],
    [summary, t],
  );

  return <StatsKpiStrip items={items} testID="stats-kpi-strip" />;
}
