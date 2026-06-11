import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors } from "../../constants/theme";
import { HEATMAP_CELL_COLORS } from "../../lib/heatmapStyle";

export const ActivityHeatmapLegend = memo(function ActivityHeatmapLegend() {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t("stats.heatmapLegendLess")}</Text>
      {HEATMAP_CELL_COLORS.map((color, index) => (
        <View key={index} style={[styles.cell, { backgroundColor: color }]} />
      ))}
      <Text style={styles.label}>{t("stats.heatmapLegendMore")}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 10,
    lineHeight: 14,
  },
  cell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
