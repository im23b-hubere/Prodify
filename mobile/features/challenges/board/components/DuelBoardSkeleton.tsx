import type { TFunction } from "i18next";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { duelBoardStyles as styles } from "../duelBoard.styles";

const RIVAL_PLACEHOLDERS = [0, 1, 2, 3];

/** Placeholder in the shape of the board, so the layout does not jump when data arrives. */
export function DuelBoardSkeleton({ t }: { t: TFunction }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[styles.board, pulse]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("friendsScreen.loading")}
      testID="duel-board-skeleton"
    >
      <View style={styles.skeletonRivals}>
        {RIVAL_PLACEHOLDERS.map((key) => (
          <View key={key} style={styles.skeletonCircle} />
        ))}
      </View>
      <View style={[styles.skeletonBlock, styles.skeletonArena]} />
      <View style={[styles.skeletonBlock, styles.skeletonList]} />
    </Animated.View>
  );
}
