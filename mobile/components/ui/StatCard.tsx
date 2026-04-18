import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";

type StatCardProps = {
  label: string;
  value: string | number;
  sublabel?: string;
  subPositive?: boolean;
};

export const StatCard = memo(function StatCard({ label, value, sublabel, subPositive = true }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sublabel ? (
        <Text style={[styles.sub, subPositive ? styles.subPos : styles.subNeg]}>{sublabel}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  label: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  sub: {
    marginTop: 4,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  subPos: { color: colors.success },
  subNeg: { color: colors.danger },
});
