import { Pressable, StyleSheet, Text } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type SessionTypeChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function SessionTypeChip({ label, active, onPress }: SessionTypeChipProps) {
  return (
    <Pressable style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]} onPress={onPress}>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.2)",
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  labelActive: {
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.88,
  },
});
