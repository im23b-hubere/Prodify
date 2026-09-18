import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors } from "../../constants/theme";
import type { HeatmapDay } from "../../features/stats/types";
import { buildHeatmapWeekGrid } from "../../features/stats/utils/heatmap";
import { heatmapCellColor } from "../../lib/heatmapStyle";
import { WEEKDAY_LETTERS } from "../../lib/weekCalendar";
import { ActivityHeatmapLegend } from "./ActivityHeatmapLegend";

type Props = { days: HeatmapDay[] };

/** Activity calendar used everywhere: one column per week, Monday–Sunday rows, legend below. */
export function ActivityHeatmapGrid({ days }: Props) {
  const { t } = useTranslation();
  const weeks = buildHeatmapWeekGrid(days);
  return (
    <>
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
                {week.days.map((day, dayIndex) =>
                  day ? (
                    <View
                      key={day.date}
                      style={[styles.cell, { backgroundColor: heatmapCellColor(day.intensity) }]}
                      accessibilityLabel={t("profileHeatmap.a11y", {
                        date: day.date,
                        seconds: day.seconds,
                      })}
                    />
                  ) : (
                    <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.cell} />
                  ),
                )}
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <ActivityHeatmapLegend />
    </>
  );
}

const CELL = 12;

const styles = StyleSheet.create({
  calendar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  weekdayCol: {
    gap: 3,
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
});
