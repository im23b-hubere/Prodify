import type { TFunction } from "i18next";
import { StyleSheet, Text, View } from "react-native";

import { ActivityHeatmapGrid } from "../../../components/charts/ActivityHeatmapGrid";
import { fontFamily } from "../../../constants/fonts";
import { colors, spacing } from "../../../constants/theme";
import { heatmapCellColor } from "../../../lib/heatmapStyle";
import { weekdayLetterFromIsoDay } from "../../../lib/sessionTime";
import {
  countHeatmapActiveDays,
  getRecentHeatmapDays,
  hasRecentHeatmapActivity,
} from "../utils/heatmap";
import type { HeatmapDay } from "../types";
import { StatsSection } from "./StatsSection";

type Props = {
  t: TFunction;
  days: HeatmapDay[];
};

export function StatsHeatmapSection({ t, days }: Props) {
  const activeDays = countHeatmapActiveDays(days);
  const recentDays = getRecentHeatmapDays(days);
  const defaultExpanded = hasRecentHeatmapActivity(days);

  return (
    <StatsSection
      title={t("stats.heatmapTitle")}
      subtitle={t("stats.heatmapCaptionShort")}
      testID="stats-section-heatmap"
      collapsible
      defaultExpanded={defaultExpanded}
      collapsedHint={t("stats.heatmapCollapsedSummary", { count: activeDays })}
      collapsedPreview={
        <View style={styles.previewRow} testID="stats-heatmap-preview">
          {recentDays.map((day) => (
            <View key={`preview-${day.date}`} style={styles.previewCell}>
              <View
                style={[styles.previewDot, { backgroundColor: heatmapCellColor(day.intensity) }]}
              />
              <Text style={styles.previewLabel}>{weekdayLetterFromIsoDay(day.date)}</Text>
            </View>
          ))}
        </View>
      }
    >
      <ActivityHeatmapGrid days={days} />
    </StatsSection>
  );
}

const styles = StyleSheet.create({
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  previewCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  previewDot: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  previewLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 10,
  },
});
