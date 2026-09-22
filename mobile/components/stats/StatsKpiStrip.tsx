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
    <View testID={testID} style={styles.shell}>
      <View style={styles.row}>
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
                  item.subPositive === true && styles.subPos,
                  item.subPositive === false && styles.subNeg,
                ]}
                numberOfLines={2}
              >
                {item.sublabel}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.lg,
    overflow: "hidden",
  },
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
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  sub: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
    color: colors.textSecondary,
  },
  subPos: { color: colors.success },
  subNeg: { color: colors.danger },
});
