import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { FlatList, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { fontFamily } from "../../../constants/fonts";
import { colors, spacing } from "../../../constants/theme";
import { STATS_BAR_CHART_HEIGHT } from "../constants";
import type { BarPoint, StatsPeriod } from "../types";
import {
  barFillScale,
  chartBarTone,
  liveChartLabel,
  todayBarGrowth,
  type TodayBarGrowth,
} from "../utils/chartBars";
import { formatChartHours } from "../utils/format";

type Props = {
  data: BarPoint[];
  period: StatsPeriod;
};

const WEEK_FIT_COUNT = 7;
const GROW_SPRING = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System };
const FILL_COLORS = {
  today: ["#ff8f66", colors.primary],
  active: ["#ff5a1f", colors.primary],
  empty: ["#2a2a2a", "#2a2a2a"],
} as const;

const AnimatedHourInput = Animated.createAnimatedComponent(TextInput);

export function SessionsPerDayChart({ data, period }: Props) {
  const liveLabel = liveChartLabel(period);
  const maxY = Math.max(1, ...data.map((point) => point.y));
  const liveHours = data.find((point) => point.label === liveLabel)?.y ?? 0;
  const lastLive = useRef<{ label: string; hours: number | null }>({
    label: liveLabel,
    hours: null,
  });
  if (lastLive.current.label !== liveLabel) {
    lastLive.current = { label: liveLabel, hours: null };
  }
  const growth = todayBarGrowth(lastLive.current.hours, liveHours);
  lastLive.current.hours = liveHours;

  if (data.length === 0) return null;

  const columns = data.map((point) => (
    <ChartColumn
      key={point.label}
      point={point}
      maxY={maxY}
      isLive={point.label === liveLabel}
      growth={point.label === liveLabel ? growth : null}
      fit
    />
  ));

  if (data.length <= WEEK_FIT_COUNT) {
    return <View style={styles.fitRow}>{columns}</View>;
  }

  return (
    <FlatList
      horizontal
      nestedScrollEnabled={Platform.OS === "android"}
      data={data}
      keyExtractor={(point, index) => `${point.label}-${index}`}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      renderItem={({ item: point }) => (
        <ChartColumn
          point={point}
          maxY={maxY}
          isLive={point.label === liveLabel}
          growth={point.label === liveLabel ? growth : null}
          fit={false}
        />
      )}
    />
  );
}

function ChartColumn({
  point,
  maxY,
  isLive,
  growth,
  fit,
}: {
  point: BarPoint;
  maxY: number;
  isLive: boolean;
  growth: TodayBarGrowth | null;
  fit: boolean;
}) {
  const tone = chartBarTone(isLive, point.y);
  const reduceMotion = useReducedMotion();
  const targetScale = barFillScale(point.y, maxY);
  const startScale =
    growth && isLive && !reduceMotion ? barFillScale(growth.fromHours, maxY) : targetScale;
  const fill = useSharedValue(startScale);
  const shownHours = useSharedValue(
    growth && isLive && !reduceMotion ? growth.fromHours : point.y,
  );

  useEffect(() => {
    if (reduceMotion || !growth || !isLive) {
      fill.set(targetScale);
      shownHours.set(point.y);
      return;
    }
    fill.set(barFillScale(growth.fromHours, maxY));
    shownHours.set(growth.fromHours);
    fill.set(withSpring(targetScale, GROW_SPRING));
    shownHours.set(withSpring(point.y, GROW_SPRING));
  }, [fill, growth, isLive, maxY, point.y, reduceMotion, shownHours, targetScale]);

  const fillStyle = useAnimatedStyle(() => ({
    height: fill.get() * STATS_BAR_CHART_HEIGHT,
  }));
  const hourProps = useAnimatedProps(() => ({
    text: formatLiveHours(shownHours.get()),
    defaultValue: formatLiveHours(shownHours.get()),
  }));

  return (
    <View
      style={[styles.column, fit ? styles.columnFit : styles.columnFixed]}
      testID={`stats-chart-col-${point.label}`}
    >
      <View style={[styles.track, tone === "today" && styles.trackToday]}>
        {tone === "empty" ? null : (
          <Animated.View
            style={[styles.fillHost, fit ? styles.fillFit : styles.fillFixed, fillStyle]}
          >
            <LinearGradient colors={[...FILL_COLORS[tone]]} style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
      </View>
      <Text
        style={[styles.axisLabel, tone === "today" && styles.axisLabelToday]}
        numberOfLines={1}
      >
        {point.x}
      </Text>
      {isLive ? (
        <AnimatedHourInput
          editable={false}
          pointerEvents="none"
          underlineColorAndroid="transparent"
          animatedProps={hourProps}
          style={[styles.count, styles.countActive, styles.countInput]}
        />
      ) : point.y > 0 ? (
        <Text style={[styles.count, styles.countActive]}>{formatChartHours(point.y)}</Text>
      ) : (
        <Text style={styles.count}> </Text>
      )}
    </View>
  );
}

function formatLiveHours(hours: number): string {
  "worklet";
  if (!Number.isFinite(hours) || hours <= 0) return "0";
  return `${Math.round(hours * 10) / 10}h`;
}

const styles = StyleSheet.create({
  fitRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    width: "100%",
    gap: 4,
    paddingTop: spacing.xs,
    paddingBottom: 2,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: spacing.xs,
    paddingBottom: 2,
  },
  column: {
    alignItems: "center",
  },
  columnFit: {
    flex: 1,
    minWidth: 0,
  },
  columnFixed: {
    width: 44,
  },
  track: {
    height: STATS_BAR_CHART_HEIGHT,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "#161616",
    borderRadius: 8,
  },
  trackToday: {
    backgroundColor: "rgba(255, 61, 0, 0.12)",
  },
  fillHost: {
    position: "absolute",
    bottom: 0,
    overflow: "hidden",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  fillFixed: {
    width: 28,
  },
  fillFit: {
    width: "55%",
    maxWidth: 22,
    minWidth: 8,
  },
  axisLabel: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fontFamily.bodyMedium,
    maxWidth: "100%",
    textAlign: "center",
  },
  axisLabelToday: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  count: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fontFamily.bodyMedium,
    minHeight: 16,
  },
  countActive: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
  },
  countInput: {
    padding: 0,
    margin: 0,
    textAlign: "center",
  },
});
