import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export type HeatmapDay = { date: string; seconds: number; intensity: number };

type Props = { days: HeatmapDay[] };

const INTENSITY = ["#2a2a2a", "rgba(255,106,61,0.25)", "rgba(255,106,61,0.45)", "rgba(255,106,61,0.7)", "#ff6a3d"];

export const ActivityHeatmapCard = memo(function ActivityHeatmapCard({ days }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Activity (90 days)</Text>
      <View style={styles.grid}>
        {days.map((d) => (
          <View
            key={d.date}
            style={[styles.cell, { backgroundColor: INTENSITY[d.intensity] ?? INTENSITY[0] }]}
            accessibilityLabel={`${d.date}: ${d.seconds} seconds`}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  cell: { width: 10, height: 10, borderRadius: 2 },
});
