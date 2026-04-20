import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography, ui } from "../../constants/theme";
import { pressFeedbackStyle } from "./pressFeedback";

type TextButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  subdued?: boolean;
  disabled?: boolean;
};

export function TextButton({
  label,
  onPress,
  accessibilityLabel,
  subdued,
  disabled,
}: TextButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressFeedbackStyle(pressed, subdued ? "light" : "default"),
        disabled && styles.disabled,
      ]}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <View style={[styles.inner, subdued && styles.innerSubdued]}>
        <Text style={[styles.label, subdued && styles.labelSubdued]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center" },
  inner: {
    minHeight: ui.buttonHeight,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  innerSubdued: {
    minHeight: 44,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  labelSubdued: { color: colors.textSecondary },
  disabled: { opacity: 0.45 },
});
