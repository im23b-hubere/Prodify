import type { TFunction } from "i18next";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { friendsSkeletonStyles as styles } from "../styles/friendsSkeleton.styles";

const RANKING_ROWS = [0, 1, 2, 3];
const ACTIVITY_ROWS = [0, 1];

/** Placeholder in the shape of the overview, so nothing jumps when the data lands. */
export function FriendsOverviewSkeleton({ t }: { t: TFunction }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [opacity, reducedMotion]);

  const breathe = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[styles.skeleton, breathe]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("friendsScreen.loading")}
      testID="friends-overview-skeleton"
    >
      <View style={styles.hero} />
      <SkeletonList rows={RANKING_ROWS} />
      <SkeletonList rows={ACTIVITY_ROWS} />
    </Animated.View>
  );
}

function SkeletonList({ rows }: { rows: number[] }) {
  return (
    <View style={styles.section}>
      <View style={styles.heading} />
      <View style={styles.card}>
        {rows.map((row) => (
          <View key={row} style={styles.row}>
            {row > 0 ? <View style={styles.rowDivider} /> : null}
            <View style={styles.avatar} />
            <View style={styles.lines}>
              <View style={styles.lineWide} />
              <View style={styles.lineNarrow} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
