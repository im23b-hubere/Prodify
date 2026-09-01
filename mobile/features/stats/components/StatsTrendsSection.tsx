import type { TFunction } from "i18next";
import { type DimensionValue, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../../../components/states/EmptyState";
import { fontFamily } from "../../../constants/fonts";
import { colors, spacing, typography } from "../../../constants/theme";
import type { BarPoint } from "../types";
import { SessionsPerDayChart } from "./SessionsPerDayChart";
import { StatsSection } from "./StatsSection";

type BreakdownItem = {
  label: string;
  value: number;
  sessions: number;
  color: string;
};

type Props = {
  t: TFunction;
  chartData: BarPoint[];
  breakdownData: BreakdownItem[];
};

function barWidth(value: number): DimensionValue {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export function StatsTrendsSection({ t, chartData, breakdownData }: Props) {
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
          <SessionsPerDayChart data={chartData} />
        </View>
      )}
      {breakdownData.length > 0 ? (
        <>
          <View style={styles.divider} />
          <View style={styles.breakdownWrap}>
            {breakdownData.map((item) => (
              <View key={item.label} style={styles.breakdownRow}>
                <View style={styles.breakdownLabelWrap}>
                  <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                  <Text style={styles.breakdownLabel}>{item.label}</Text>
                </View>
                <View style={styles.breakdownTrack}>
                  <View
                    style={[
                      styles.breakdownFill,
                      { width: barWidth(item.value), backgroundColor: item.color },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownValue}>
                  {t("stats.typeMixMeta", { sessions: item.sessions, percent: item.value })}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : chartData.length > 0 ? (
        <>
          <View style={styles.divider} />
          <EmptyState compact title={t("stats.typeMixEmptyTitle")} message={t("stats.typeMixEmpty")} />
        </>
      ) : null}
    </StatsSection>
  );
}

const styles = StyleSheet.create({
  chartInner: {
    marginTop: spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  breakdownWrap: {
    gap: spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    width: 132,
    gap: spacing.xs,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    flexShrink: 1,
  },
  breakdownTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#222222",
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: 5,
  },
  breakdownValue: {
    color: colors.textSecondary,
    minWidth: 108,
    textAlign: "right",
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
});
