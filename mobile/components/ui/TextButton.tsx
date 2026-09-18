import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography, ui } from "../../constants/theme";
import { pressFeedbackStyle } from "./pressFeedback";

type TextButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  subdued?: boolean;
  disabled?: boolean;
  /** Trailing chevron for links that open another screen. */
  chevron?: boolean;
  /** Brand-colored label, for links that should stand out. */
  accent?: boolean;
};

export function TextButton({
  label,
  onPress,
  accessibilityLabel,
  subdued,
  disabled,
  chevron,
  accent,
}: TextButtonProps) {
  const tint = accent ? colors.primary : colors.textSecondary;
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
      <View style={[styles.inner, subdued && styles.innerSubdued, chevron && styles.innerRow]}>
        <Text style={[styles.label, subdued && styles.labelSubdued, { color: tint }]}>{label}</Text>
        {chevron ? <ChevronRight color={tint} size={14} strokeWidth={2.4} /> : null}
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
  innerRow: { flexDirection: "row", gap: 2 },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  labelSubdued: { color: colors.textSecondary },
  disabled: { opacity: 0.45 },
});
