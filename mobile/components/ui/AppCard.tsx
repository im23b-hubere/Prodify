import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import * as Haptics from "expo-haptics";
import { colors, ui } from "../../constants/theme";
import { pressFeedbackStyle } from "./pressFeedback";

type AppCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

export const AppCard = memo(function AppCard({
  children,
  style,
  onPress,
  disabled,
  testID,
}: AppCardProps) {
  if (!onPress) {
    return (
      <View style={[styles.card, style]} testID={testID}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      disabled={disabled}
      testID={testID}
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
