import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type BadgeIconProps = {
  label: string;
  unlocked: boolean;
};

export function BadgeIcon({ label, unlocked }: BadgeIconProps) {
  return (
    <View style={[styles.badge, unlocked ? styles.badgeUnlocked : styles.badgeLocked]}>
      <Text style={[styles.icon, unlocked ? styles.iconUnlocked : styles.iconLocked]}>
        {unlocked ? "★" : "☆"}
      </Text>
      <Text style={[styles.label, unlocked ? styles.labelUnlocked : styles.labelLocked]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 120,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  badgeUnlocked: {
    backgroundColor: "#2a190f",
    borderColor: "#6f3f1f",
  },
  badgeLocked: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 24,
  },
  iconUnlocked: {
    color: colors.primary,
  },
  iconLocked: {
    color: colors.textSecondary,
  },
  label: {
    textAlign: "center",
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  labelUnlocked: {
    color: colors.textPrimary,
  },
  labelLocked: {
    color: colors.textSecondary,
  },
});
