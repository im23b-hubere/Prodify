import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { colors, spacing } from "../../constants/theme";

type WeekProgressDotsProps = {
  activeDays: boolean[];
};

function ProgressDot({ filled, delay }: { filled: boolean; delay: number }) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withDelay(delay, withTiming(filled ? 1 : 0.6, { duration: 350 }));
    opacity.value = withDelay(delay, withTiming(filled ? 1 : 0.3, { duration: 350 }));
  }, [delay, filled, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty, animatedStyle]} />;
}

export function WeekProgressDots({ activeDays }: WeekProgressDotsProps) {
  return (
    <View style={styles.row}>
      {activeDays.map((filled, idx) => (
        <ProgressDot key={idx} filled={filled} delay={idx * 80} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotFilled: {
    backgroundColor: colors.primary,
  },
  dotEmpty: {
    backgroundColor: "#2a2a2a",
  },
});
