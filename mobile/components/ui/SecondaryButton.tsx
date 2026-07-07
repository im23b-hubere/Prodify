import { Pressable, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography, ui } from "../../constants/theme";
import { pressFeedbackStyle } from "./pressFeedback";

type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function SecondaryButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  testID,
}: SecondaryButtonProps) {
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        pressFeedbackStyle(pressed, "default"),
        pressed && styles.pressedVisual,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: ui.buttonHeight,
    borderRadius: ui.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  label: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
  },
  pressedVisual: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  disabled: { opacity: 0.5, borderColor: "rgba(255,255,255,0.1)" },
});
