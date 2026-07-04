import { StyleSheet, Text, View } from "react-native";

import { AppFlame, glyphRowStyle } from "../icons/ProdifyGlyphs";
import { fontFamily } from "../../constants/fonts";
import { colors, spacing } from "../../constants/theme";

type Props = {
  label: string;
  value: string;
  accent?: boolean;
  icon?: "flame";
};

export function StatTile({ label, value, accent = false, icon }: Props) {
  return (
    <View style={[styles.tile, accent && styles.tileAccent]}>
      <Text style={styles.label}>{label}</Text>
      <View style={glyphRowStyle}>
        {icon === "flame" ? <AppFlame size={14} /> : null}
        <Text style={[styles.value, accent && styles.valueAccent]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 88,
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    gap: 4,
  },
  tileAccent: {
    borderColor: "rgba(0,255,136,0.35)",
    backgroundColor: "rgba(0,255,136,0.08)",
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
  },
  valueAccent: {
    color: colors.success,
  },
});
