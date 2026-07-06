import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { fontFamily } from "../../constants/fonts";
import { colors, shadows, spacing, typography, ui } from "../../constants/theme";
import { pressFeedbackStyle } from "./pressFeedback";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  accessibilityLabel,
  testID,
}: PrimaryButtonProps) {
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.wrap,
        pressFeedbackStyle(pressed, "strong"),
        (disabled || loading) && styles.disabled,
      ]}
    >
      <LinearGradient
        colors={["#ff5a1f", colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? <ActivityIndicator color={colors.textPrimary} /> : icon}
        {!loading ? <Text style={styles.label}>{label}</Text> : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: ui.cardRadius,
    ...shadows.button,
  },
  gradient: {
    minHeight: ui.buttonHeight,
    borderRadius: ui.cardRadius,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  label: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
  },
  disabled: {
    opacity: 0.5,
  },
});
