import type { TFunction } from "i18next";
import { StyleSheet, Text, View } from "react-native";

import { ActivityHeatmapLegend } from "../../../components/charts/ActivityHeatmapLegend";
import { fontFamily } from "../../../constants/fonts";
import { colors, spacing } from "../../../constants/theme";
import { heatmapCellColor } from "../../../lib/heatmapStyle";
import { WEEKDAY_LETTERS } from "../../../lib/weekCalendar";
import { weekdayLetterFromIsoDay } from "../../../lib/sessionTime";
import {
  buildHeatmapWeekGrid,
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
  const weeks = buildHeatmapWeekGrid(days);

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
      {weeks.length > 0 ? (
        <View style={styles.calendar}>
          <View style={styles.weekdayCol}>
            {WEEKDAY_LETTERS.map((letter, index) => (
              <Text key={`${letter}-${index}`} style={styles.weekdayLabel}>
                {letter}
              </Text>
            ))}
          </View>
          <View style={styles.weeks}>
            {weeks.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={styles.weekCol}>
                {week.days.map((day, dayIndex) => (
                  <View
                    key={day?.date ?? `empty-${weekIndex}-${dayIndex}`}
                    style={[
                      styles.cell,
                      day
                        ? { backgroundColor: heatmapCellColor(day.intensity) }
                        : styles.cellEmpty,
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <ActivityHeatmapLegend />
    </StatsSection>
  );
}

const CELL = 12;

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
  calendar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  weekdayCol: {
    gap: 3,
    paddingTop: 0,
  },
  weekdayLabel: {
    height: CELL,
    width: 12,
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 9,
    lineHeight: CELL,
    textAlign: "center",
  },
  weeks: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
  },
  weekCol: {
    flex: 1,
    gap: 3,
    alignItems: "center",
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },
  cellEmpty: {
    backgroundColor: "transparent",
  },
});
