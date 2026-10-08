import { ActivityIndicator, StyleSheet, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography } from "../../constants/theme";

type LoadingStateProps = {
  message: string;
};

/**
 * A spinner and a quiet line of text straight on the page, with no card behind them. It fades
 * in after a short pause, so loads that finish quickly never flash it.
 */
export function LoadingState({ message }: LoadingStateProps) {
  return (
    <Animated.View
      entering={FadeIn.delay(150).duration(220)}
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
    textAlign: "center",
  },
});
