import { useMemo } from "react";
import { Text, View } from "react-native";

import { AppFlame, glyphRowStyle } from "../../../components/icons/ProdifyGlyphs";
import { StatsKpiStrip, type KpiItem } from "../../../components/stats/StatsKpiStrip";
import type { StatsScreenController } from "../hooks/useStatsScreenController";
import { styles } from "../statsScreen.styles";

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
      { key: "sessions", label: t("stats.sessions"), value: summary.sessions },
      {
        key: "streak",
        label: t("stats.currentStreak"),
        value: (
          <View style={glyphRowStyle}>
            <AppFlame size={18} />
            <Text style={styles.kpiStreakValue}>{summary.streak}</Text>
          </View>
        ),
        sublabel: t("stats.bestStreakSub", { days: summary.bestStreak }),
      },
    ],
    [summary, t],
  );

  return <StatsKpiStrip items={items} testID="stats-kpi-strip" />;
}
