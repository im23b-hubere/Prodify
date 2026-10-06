import type { TFunction } from "i18next";
import { StyleSheet, View } from "react-native";

import { EmptyState } from "../../../components/states/EmptyState";
import { spacing } from "../../../constants/theme";
import type { BarPoint, StatsPeriod } from "../types";
import { SessionsPerDayChart } from "./SessionsPerDayChart";
import { StatsSection } from "./StatsSection";

type Props = {
  t: TFunction;
  chartData: BarPoint[];
  period: StatsPeriod;
};

export function StatsTrendsSection({ t, chartData, period }: Props) {
  return (
    <StatsSection
      title={t("stats.trendsSectionTitle")}
      subtitle={t("stats.trendsSectionSubtitle")}
      testID="stats-section-trends"
    >
      {chartData.length === 0 ? (
        <EmptyState compact title={t("stats.perDayEmptyTitle")} message={t("stats.perDayEmpty")} />
      ) : (
        <View style={styles.chartInner}>
          <SessionsPerDayChart data={chartData} period={period} />
        </View>
      )}
    </StatsSection>
  );
}

const styles = StyleSheet.create({
  chartInner: {
    marginTop: spacing.xs,
  },
});
