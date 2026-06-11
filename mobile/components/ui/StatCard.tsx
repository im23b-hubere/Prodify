import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography, ui } from "../../constants/theme";

type StatCardProps = {
  label: string;
  value: string | number | ReactNode;
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
      {typeof value === "string" || typeof value === "number" ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        <View style={styles.valueRow}>{value}</View>
      )}
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
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
