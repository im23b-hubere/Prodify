import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography, ui } from "../../constants/theme";

type StatCardProps = {
  label: string;
  value: string | number;
  sublabel?: string;
  subPositive?: boolean;
};

export const StatCard = memo(function StatCard({
  label,
  value,
  sublabel,
  subPositive = true,
}: StatCardProps) {
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
    borderRadius: ui.cardRadius,
    borderWidth: ui.cardBorderWidth,
    borderColor: colors.border,
    padding: ui.cardPadding,
    gap: spacing.xs,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  sub: {
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  subPos: { color: colors.success },
  subNeg: { color: colors.danger },
});
