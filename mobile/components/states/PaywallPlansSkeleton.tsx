import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { radii, spacing, ui } from "../../constants/theme";

/**
 * Loading placeholder for the paywall purchase options.
 *
 * Mirrors the final layout (two plan buttons + a restore link) so nothing
 * jumps when the real offerings resolve, and pulses subtly instead of showing
 * a spinner wedged between the copy and disabled buttons.
 */
export function PaywallPlansSkeleton() {
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessible>
      <Animated.View style={[styles.plan, pulseStyle]} />
      <Animated.View style={[styles.plan, pulseStyle]} />
      <Animated.View style={[styles.restore, pulseStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  plan: {
    height: ui.buttonHeight,
    borderRadius: ui.cardRadius,
    backgroundColor: "#242424",
  },
  restore: {
    alignSelf: "center",
    height: 14,
    width: "42%",
    borderRadius: radii.sm,
    backgroundColor: "#1c1c1c",
    marginTop: spacing.xs,
  },
});
