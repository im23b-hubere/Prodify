import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "../../../constants/theme";

function Segment({ filled }: { filled: boolean }) {
  const fill = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    fill.set(withTiming(filled ? 1 : 0, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [fill, filled]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

/** Where you are in onboarding: one thin bar per page, filled up to the current one. */
export function OnboardingSegments({ count, current }: { count: number; current: number }) {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no">
      {Array.from({ length: count }, (_, index) => (
        <Segment key={index} filled={index <= current} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "#222222",
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
});
