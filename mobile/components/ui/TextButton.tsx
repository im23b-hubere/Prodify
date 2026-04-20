import { Pressable, StyleSheet, Text } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography } from "../../constants/theme";

type TextButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function TextButton({ label, onPress, accessibilityLabel }: TextButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", paddingVertical: spacing.md },
  pressed: { opacity: 0.85 },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
});
