import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { engagementDebugStyles as styles } from "./engagementDebug.styles";

const BLOCK_HEIGHTS = [132, 56, 168, 168, 120];

/** Mirrors the decision card, the evaluate button and the sections below it. */
export function EngagementDebugSkeleton({ label }: { label: string }) {
  const pulse = useSharedValue(0.45);

  useEffect(() => {
    pulse.set(
      withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View
      style={styles.content}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      testID="engagement-debug-skeleton"
    >
      {BLOCK_HEIGHTS.map((height, index) => (
        <Animated.View key={index} style={[styles.skeletonBlock, { height }, pulseStyle]} />
      ))}
    </View>
  );
}
