import { LinearGradient } from "expo-linear-gradient";
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
  variant?: "default" | "hero" | "inset";
};

export const StatsKpiStrip = memo(function StatsKpiStrip({
  items,
  testID,
  variant = "default",
}: Props) {
  const isHero = variant === "hero";
  const isInset = variant === "inset";
  const useHeroRow = isHero || isInset;

  const strip = (
    <View style={[styles.row, useHeroRow && styles.rowHero, isInset && styles.rowInset]}>
      {items.map((item, index) => (
        <View
          key={item.key}
          style={[
            styles.cell,
            useHeroRow && styles.cellHero,
            isInset && styles.cellInset,
            index < items.length - 1 && styles.cellBorder,
            useHeroRow && index < items.length - 1 && styles.cellBorderHero,
          ]}
        >
          {typeof item.value === "string" || typeof item.value === "number" ? (
            <Text
              style={[styles.value, useHeroRow && styles.valueHero, isInset && styles.valueInset]}
            >
              {item.value}
            </Text>
          ) : (
            <View style={styles.valueRow}>{item.value}</View>
          )}
          <Text style={[styles.label, useHeroRow && styles.labelHero]} numberOfLines={1}>
            {item.label}
          </Text>
          {item.sublabel ? (
            <Text
              style={[
                styles.sub,
                useHeroRow && styles.subHero,
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

  if (isHero) {
    return (
      <LinearGradient
        colors={["#3d1510", "#1a1010", "#0f0f0f"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroShell}
        testID={testID}
      >
        {strip}
      </LinearGradient>
    );
  }

  if (isInset) {
    return (
      <View testID={testID} style={styles.insetShell}>
        {strip}
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.defaultShell}>
      {strip}
    </View>
  );
});

const styles = StyleSheet.create({
  defaultShell: {
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  heroShell: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  insetShell: {
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
  rowHero: {
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  rowInset: {
    borderRadius: 0,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: 2,
  },
  cellHero: {
    paddingVertical: spacing.md,
  },
  cellInset: {
    paddingVertical: spacing.sm,
  },
  cellBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  cellBorderHero: {
    borderRightColor: "rgba(255,255,255,0.1)",
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
  },
  valueHero: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  valueInset: {
    fontSize: 26,
    lineHeight: 30,
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
  labelHero: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sub: {
    fontFamily: fontFamily.body,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 13,
  },
  subHero: {
    fontSize: 11,
    lineHeight: 14,
  },
  subPos: { color: colors.success },
  subNeg: { color: colors.danger },
});
