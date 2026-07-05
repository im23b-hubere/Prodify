import { useEffect, useRef } from "react";
import { Animated, Easing, ScrollView, StyleSheet, View } from "react-native";

import { AppCard } from "../../../components/ui/AppCard";
import { spacing } from "../../../constants/theme";

function SkeletonLine({
  style,
  durationMs = 850,
  minOpacity = 0.5,
}: {
  style?: object;
  durationMs?: number;
  minOpacity?: number;
}) {
  const pulse = useRef(new Animated.Value(0.5)).current;

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
          toValue: minOpacity,
          duration: durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [durationMs, minOpacity, pulse]);

  return <Animated.View style={[styles.line, { opacity: pulse }, style]} />;
}

export function StatsSkeleton() {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
      >
        {[0, 1, 2].map((idx) => (
          <AppCard key={`sk-stat-${idx}`} style={styles.statCard}>
            <SkeletonLine style={styles.label} durationMs={760} minOpacity={0.56} />
            <SkeletonLine style={styles.value} durationMs={760} minOpacity={0.56} />
            <SkeletonLine style={styles.sub} durationMs={760} minOpacity={0.56} />
          </AppCard>
        ))}
      </ScrollView>
      {[0, 1, 2].map((idx) => (
        <AppCard key={`sk-card-${idx}`} style={styles.blockCard}>
          <SkeletonLine style={styles.title} durationMs={980} minOpacity={0.5} />
          <SkeletonLine style={styles.body} durationMs={980} minOpacity={0.5} />
          <SkeletonLine style={styles.bodyShort} durationMs={980} minOpacity={0.5} />
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  cardRow: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  statCard: {
    width: 162,
    gap: spacing.sm,
  },
  blockCard: {
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  line: {
    height: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  label: {
    width: "46%",
  },
  value: {
    width: "62%",
    height: 24,
    backgroundColor: "rgba(255,255,255,0.11)",
  },
  sub: {
    width: "55%",
  },
  title: {
    width: "40%",
  },
  body: {
    width: "100%",
  },
  bodyShort: {
    width: "72%",
  },
});
