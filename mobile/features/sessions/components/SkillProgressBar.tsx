import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { styles } from "../sessionComplete.styles";

const FILL_DURATION_MS = 700;
const FILL_DELAY_MS = 250;

type SkillProgressBarProps = {
  accent: string;
  /** Fill before this session; the bar grows from here so the gain is visible. */
  fromFraction: number;
  toFraction: number;
};

export function SkillProgressBar({ accent, fromFraction, toFraction }: SkillProgressBarProps) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(reduceMotion ? toFraction : fromFraction);

  useEffect(() => {
    if (reduceMotion) {
      fill.set(toFraction);
      return;
    }
    fill.set(
      withDelay(
        FILL_DELAY_MS,
        withTiming(toFraction, { duration: FILL_DURATION_MS, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [fill, reduceMotion, toFraction]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { backgroundColor: accent }, fillStyle]} />
    </View>
  );
}
