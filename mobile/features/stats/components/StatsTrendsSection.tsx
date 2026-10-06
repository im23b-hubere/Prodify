import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../../../components/states/EmptyState";
import { fontFamily } from "../../../constants/fonts";
import { colors, spacing, typography } from "../../../constants/theme";
import type { BarPoint, StatsPeriod } from "../types";
import type { ChartRecordMark } from "../utils/chartRecords";
import { chartRecordCaption } from "../utils/chartRecords";
import { SessionsPerDayChart } from "./SessionsPerDayChart";
import { StatsSection } from "./StatsSection";

type Props = {
  t: TFunction;
  chartData: BarPoint[];
  recordMarks: ChartRecordMark[];
  period: StatsPeriod;
};

export function StatsTrendsSection({ t, chartData, recordMarks, period }: Props) {
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  useEffect(() => {
    setPickedLabel(null);
  }, [period]);

  const captionMark =
    recordMarks.find((mark) => mark.barLabel === pickedLabel) ??
    (recordMarks.length === 1 ? recordMarks[0] : null);

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
          <SessionsPerDayChart
            data={chartData}
            period={period}
            marks={recordMarks}
            selectedBarLabel={captionMark?.barLabel ?? null}
            recordHint={t("stats.chartRecordHint")}
            onSelectBar={setPickedLabel}
          />
          {captionMark ? (
            <Text
              testID="stats-chart-record-caption"
              style={styles.caption}
              accessibilityLiveRegion="polite"
            >
              {chartRecordCaption(captionMark.record, t)}
            </Text>
          ) : null}
        </View>
      )}
    </StatsSection>
  );
}

const styles = StyleSheet.create({
  chartInner: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  caption: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    textAlign: "center",
  },
});
