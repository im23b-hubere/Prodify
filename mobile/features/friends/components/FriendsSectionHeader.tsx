import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

export function FriendsSectionHeader({
  title,
  subtitle,
  icon,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.headerRow}>
      {icon ? <View style={styles.headerIconWrap}>{icon}</View> : null}
      <View style={styles.headerTextCol}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  headerRight: { marginLeft: "auto", alignSelf: "center" },
  headerTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
    lineHeight: 22,
  },
  headerSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
});
