import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { AppCard } from "../ui/AppCard";
import { colors, radii, spacing, typography, ui } from "../../constants/theme";

function ShimmerLine({
  style,
  durationMs = 780,
}: {
  style?: object;
  durationMs?: number;
}) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [durationMs, pulse]);

  return <Animated.View style={[styles.line, { opacity: pulse }, style]} />;
}

type Props = {
  hero?: boolean;
  rankRows?: number;
};

export function ProgressionOverviewSkeleton({ hero = true, rankRows = 6 }: Props) {
  return (
    <View style={styles.wrap}>
      {hero ? (
        <AppCard style={styles.heroCard}>
          <ShimmerLine style={styles.heroTitle} />
          <ShimmerLine style={styles.heroMeta} />
          <ShimmerLine style={styles.heroTrack} />
          <ShimmerLine style={styles.heroMetaWide} />
        </AppCard>
      ) : null}
      <AppCard style={styles.ranksCard}>
        <ShimmerLine style={styles.ranksTitle} />
        <View style={styles.rankRows}>
          {Array.from({ length: rankRows }, (_, i) => (
            <View key={`rank-sk-${i}`} style={styles.rankRow}>
              <ShimmerLine style={styles.rankRowTitle} />
              <ShimmerLine style={styles.rankRowMeta} />
            </View>
          ))}
        </View>
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  heroCard: {
    gap: spacing.sm,
  },
  ranksCard: {
    gap: spacing.sm,
  },
  line: {
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  heroTitle: {
    height: typography.cardTitle.fontSize + 4,
    width: "62%",
  },
  heroMeta: {
    height: typography.meta.lineHeight,
    width: "38%",
  },
  heroMetaWide: {
    height: typography.meta.lineHeight,
    width: "72%",
  },
  heroTrack: {
    height: 10,
    width: "100%",
    borderRadius: radii.round,
    marginTop: spacing.xs,
  },
  ranksTitle: {
    height: typography.cardTitle.fontSize + 2,
    width: "44%",
  },
  rankRows: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  rankRow: {
    borderRadius: radii.md,
    borderWidth: ui.cardBorderWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  rankRowTitle: {
    height: typography.meta.lineHeight,
    width: "70%",
  },
  rankRowMeta: {
    height: typography.caption.lineHeight,
    width: "40%",
  },
});
