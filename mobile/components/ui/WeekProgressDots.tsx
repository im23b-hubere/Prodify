import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { colors, spacing } from "../../constants/theme";

export type WeekDotKind = "none" | "session" | "freeze";

type WeekProgressDotsProps = {
  /** @deprecated prefer dayKinds */
  activeDays?: boolean[];
  /** Per column: session = primary, freeze = secondary accent, none = empty */
  dayKinds?: WeekDotKind[];
};

function ProgressDot({ kind, delay }: { kind: WeekDotKind; delay: number }) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0.3);

  const filled = kind !== "none";

  useEffect(() => {
    scale.value = withDelay(delay, withTiming(filled ? 1 : 0.6, { duration: 350 }));
    opacity.value = withDelay(delay, withTiming(filled ? 1 : 0.3, { duration: 350 }));
  }, [delay, filled, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const base =
    kind === "session" ? styles.dotSession : kind === "freeze" ? styles.dotFreeze : styles.dotEmpty;

  return <Animated.View style={[styles.dot, base, animatedStyle]} />;
}

export function WeekProgressDots({ activeDays, dayKinds }: WeekProgressDotsProps) {
  const kinds: WeekDotKind[] = dayKinds ??
    activeDays?.map((filled) => (filled ? "session" : "none")) ?? [
      "none",
      "none",
      "none",
      "none",
      "none",
      "none",
      "none",
    ];

  return (
    <View style={styles.row}>
      {kinds.map((kind, idx) => (
        <ProgressDot key={idx} kind={kind} delay={idx * 80} />
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
  dotSession: {
    backgroundColor: colors.primary,
  },
  dotFreeze: {
    backgroundColor: colors.secondary,
  },
  dotEmpty: {
    backgroundColor: "#2a2a2a",
  },
});
