import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing } from "../../constants/theme";

export type KpiItem = {
  key: string;
  label: string;
  value: string | number | ReactNode;
  sublabel?: string;
  subPositive?: boolean;
};

type Props = {
  items: KpiItem[];
  testID?: string;
};

export const StatsKpiStrip = memo(function StatsKpiStrip({ items, testID }: Props) {
  return (
    <View style={styles.row} testID={testID}>
      {items.map((item, index) => (
        <View
          key={item.key}
          style={[styles.cell, index < items.length - 1 && styles.cellBorder]}
        >
          {typeof item.value === "string" || typeof item.value === "number" ? (
            <Text style={styles.value}>{item.value}</Text>
          ) : (
            <View style={styles.valueRow}>{item.value}</View>
          )}
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
          {item.sublabel ? (
            <Text
              style={[
                styles.sub,
                item.subPositive === false ? styles.subNeg : styles.subPos,
              ]}
              numberOfLines={2}
            >
              {item.sublabel}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: 2,
  },
  cellBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 11,
    textAlign: "center",
  },
  sub: {
    fontFamily: fontFamily.body,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 13,
  },
  subPos: { color: colors.success },
  subNeg: { color: colors.danger },
});
