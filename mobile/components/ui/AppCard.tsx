import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import * as Haptics from "expo-haptics";
import { colors, ui } from "../../constants/theme";
import { pressFeedbackStyle } from "./pressFeedback";

type AppCardProps = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  disabled?: boolean;
};

export const AppCard = memo(function AppCard({ children, style, onPress, disabled }: AppCardProps) {
  if (!onPress) {
    return <View style={[styles.card, style]}>{children}</View>;
  }
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        style,
        pressFeedbackStyle(pressed, "default"),
        pressed && styles.cardPressedVisual,
        disabled && styles.cardDisabled,
      ]}
    >
      {children}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: ui.cardRadius,
    borderWidth: ui.cardBorderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: ui.cardPadding,
    gap: ui.compactGap,
  },
  cardPressedVisual: {
    borderColor: "rgba(255,255,255,0.16)",
  },
  cardDisabled: {
    opacity: 0.55,
  },
});
