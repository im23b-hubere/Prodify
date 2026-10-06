import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../../../components/states/EmptyState";
import { fontFamily } from "../../../constants/fonts";
import { colors, spacing, typography } from "../../../constants/theme";
import type { BarPoint, StatsPeriod } from "../types";
import { buildChartHero, chartBarRangeLabel } from "../utils/chartHero";
import type { ChartRecordMark } from "../utils/chartRecords";
import { chartRecordCaption } from "../utils/chartRecords";
import { formatChartHours } from "../utils/format";
import { SessionsPerDayChart } from "./SessionsPerDayChart";
import { StatsSection } from "./StatsSection";

type Props = {
  t: TFunction;
  chartData: BarPoint[];
  recordMarks: ChartRecordMark[];
  period: StatsPeriod;
  totalSeconds: number;
};

export function StatsTrendsSection({ t, chartData, recordMarks, period, totalSeconds }: Props) {
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  useEffect(() => {
    setPickedLabel(null);
  }, [period]);

  const hero = buildChartHero(chartData, period, totalSeconds);
  const selectedPoint = chartData.find((point) => point.label === pickedLabel) ?? null;
  const selectedRecord = recordMarks.find((mark) => mark.barLabel === pickedLabel)?.record ?? null;
  const eyebrow = selectedPoint
    ? t("stats.chartHours")
    : hero.averageKind === "perDay"
      ? t("stats.chartAveragePerDay")
      : t("stats.chartAverage");
  const valueHours = selectedPoint ? selectedPoint.y : hero.averageHours;
  const range = selectedPoint ? chartBarRangeLabel(selectedPoint, period) : hero.rangeLabel;
  const caption = selectedRecord ? chartRecordCaption(selectedRecord, t) : null;

  return (
    <StatsSection title={t("stats.trendsSectionTitle")} testID="stats-section-trends">
      {chartData.length === 0 ? (
        <EmptyState compact title={t("stats.perDayEmptyTitle")} message={t("stats.perDayEmpty")} />
      ) : (
        <View style={styles.chartInner}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text testID="stats-chart-average" style={styles.value}>
              {formatChartHours(valueHours)}
            </Text>
            <Text testID="stats-chart-range" style={styles.range}>
              {range}
            </Text>
            {caption ? (
              <Text
                testID="stats-chart-record-caption"
                style={styles.caption}
                accessibilityLiveRegion="polite"
              >
                {caption}
              </Text>
            ) : null}
          </View>
          <SessionsPerDayChart
            data={chartData}
            period={period}
            marks={recordMarks}
            selectedBarLabel={pickedLabel}
            recordHint={t("stats.chartRecordHint")}
            onSelectBar={(label) => setPickedLabel((current) => (current === label ? null : label))}
          />
        </View>
      )}
    </StatsSection>
  );
}

const styles = StyleSheet.create({
  chartInner: {
    gap: spacing.md,
  },
  hero: {
    gap: 2,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.6,
  },
  range: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  caption: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
});
