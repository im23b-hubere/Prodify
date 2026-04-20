import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { ProgressionDto } from "../../types/outcomes";

type Props = {
  progression: ProgressionDto | null;
};

export const ProgressionBarCard = memo(function ProgressionBarCard({ progression }: Props) {
  const level = progression?.current_level ?? 1;
  const xp = progression?.xp_total ?? 0;
  const xpToNext = progression?.xp_to_next_level ?? 50;
  const pct = Math.max(0, Math.min(100, progression?.progress_percent ?? 0));
  const nextLevel = level + 1;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Level {level}</Text>
        <Text style={styles.sub}>{xp} XP total</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.sub}>
        {xpToNext} XP to level {nextLevel} ({Math.round(pct)}%)
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.subheadline },
  sub: { color: colors.textSecondary, ...typography.caption },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.primary },
});
