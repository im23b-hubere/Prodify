import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { duelBoardStyles as styles } from "../duelBoard.styles";

const FILL_TIMING = { duration: 700, easing: Easing.bezier(0.23, 1, 0.32, 1) };

type Props = {
  label: string;
  current: number;
  target: number;
  highlighted?: boolean;
};

/** One racer's lane: fills toward the target and animates whenever the score changes. */
export function DuelProgressBar({ label, current, target, highlighted = false }: Props) {
  const ratio = target > 0 ? Math.min(1, current / target) : 0;
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.set(withTiming(ratio, FILL_TIMING));
  }, [fill, ratio]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, highlighted && styles.barFillAccent, fillStyle]} />
      </View>
      <Text style={styles.barValue}>
        {current}/{target}
      </Text>
    </View>
  );
}
