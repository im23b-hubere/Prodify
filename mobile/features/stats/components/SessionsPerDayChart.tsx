import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { fontFamily } from "../../../constants/fonts";
import { colors, motion, spacing } from "../../../constants/theme";
import { STATS_BAR_CHART_HEIGHT } from "../constants";
import type { BarPoint, StatsPeriod } from "../types";
import type { ChartRecordMark } from "../utils/chartRecords";
import {
  barFillScale,
  chartBarTone,
  liveChartLabel,
  todayBarGrowth,
  type TodayBarGrowth,
} from "../utils/chartBars";
import { chartPlotMax, chartYTicks } from "../utils/chartHero";
import { formatChartHours } from "../utils/format";

type Props = {
  data: BarPoint[];
  period: StatsPeriod;
  marks: ChartRecordMark[];
  selectedBarLabel: string | null;
  recordHint: string;
  onSelectBar: (label: string) => void;
};

const GROW_SPRING = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System };
const Y_AXIS_WIDTH = 28;

export function SessionsPerDayChart({
  data,
  period,
  marks,
  selectedBarLabel,
  recordHint,
  onSelectBar,
}: Props) {
  const liveLabel = liveChartLabel(period, new Date(), data);
  const maxY = Math.max(0, ...data.map((point) => point.y));
  const plotMax = chartPlotMax(maxY);
  const yTicks = chartYTicks(maxY);
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

  const dense = data.length > 7;
  const markKeys = new Map(marks.map((mark) => [mark.barLabel, mark.record.key]));
  const hasSelection = Boolean(selectedBarLabel);

  return (
    <View style={styles.chart}>
      <View style={styles.plotRow}>
        <View testID="stats-chart-fit" style={[styles.plot, dense ? styles.plotDense : null]}>
          <View pointerEvents="none" testID="stats-chart-grid" style={StyleSheet.absoluteFill}>
            {yTicks.map((tick) => (
              <View
                key={tick}
                style={[styles.gridLine, { bottom: (tick / plotMax) * STATS_BAR_CHART_HEIGHT }]}
              />
            ))}
          </View>
          {data.map((point) => (
            <ChartColumn
              key={point.label}
              point={point}
              plotMax={plotMax}
              isLive={point.label === liveLabel}
              growth={point.label === liveLabel ? growth : null}
              dense={dense}
              recordKey={markKeys.get(point.label) ?? null}
              selected={selectedBarLabel === point.label}
              dimmed={hasSelection && selectedBarLabel !== point.label}
              recordHint={recordHint}
              onSelectBar={onSelectBar}
            />
          ))}
        </View>
        <View style={styles.yAxis}>
          {yTicks.map((tick) => (
            <Text
              key={tick}
              style={[styles.yTick, { bottom: (tick / plotMax) * STATS_BAR_CHART_HEIGHT - 6 }]}
            >
              {formatYTick(tick)}
            </Text>
          ))}
        </View>
      </View>
      <View style={[styles.axisRow, dense ? styles.axisRowDense : null]}>
        {data.map((point) => (
          <Text
            key={point.label}
            style={[styles.axisLabel, dense ? styles.axisLabelDense : null]}
            numberOfLines={1}
          >
            {point.x ? point.x : " "}
          </Text>
        ))}
      </View>
    </View>
  );
}

function ChartColumn({
  point,
  plotMax,
  isLive,
  growth,
  dense,
  recordKey,
  selected,
  dimmed,
  recordHint,
  onSelectBar,
}: {
  point: BarPoint;
  plotMax: number;
  isLive: boolean;
  growth: TodayBarGrowth | null;
  dense: boolean;
  recordKey: string | null;
  selected: boolean;
  dimmed: boolean;
  recordHint: string;
  onSelectBar: (label: string) => void;
}) {
  const tone = chartBarTone(isLive, point.y);
  const reduceMotion = useReducedMotion();
  const targetScale = barFillScale(point.y, plotMax);
  const startScale =
    growth && isLive && !reduceMotion ? barFillScale(growth.fromHours, plotMax) : targetScale;
  const fill = useSharedValue(startScale);

  useEffect(() => {
    if (reduceMotion || !growth || !isLive) {
      fill.set(targetScale);
      return;
    }
    fill.set(barFillScale(growth.fromHours, plotMax));
    fill.set(withSpring(targetScale, GROW_SPRING));
  }, [fill, growth, isLive, plotMax, reduceMotion, targetScale]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: fill.get() }],
  }));

  const hoursLabel = point.y > 0 ? formatChartHours(point.y) : "0";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${point.x || point.label}, ${hoursLabel}`}
      accessibilityHint={recordKey ? recordHint : undefined}
      testID={`stats-chart-col-${point.label}`}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onSelectBar(point.label);
      }}
      style={({ pressed }) => [styles.column, pressed ? styles.columnPressed : null]}
    >
      <View style={styles.barSlot}>
        {tone === "empty" ? null : (
          <Animated.View
            style={[
              styles.fill,
              dense ? styles.fillDense : styles.fillFit,
              dimmed ? styles.fillDimmed : null,
              fillStyle,
            ]}
          />
        )}
        {recordKey ? (
          <View
            testID={`stats-chart-record-${point.label}`}
            style={[styles.marker, selected ? styles.markerSelected : null]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function formatYTick(hours: number): string {
  if (hours === 0) return "0";
  return String(hours);
}

const styles = StyleSheet.create({
  chart: {
    gap: 6,
  },
  plotRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  plot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    height: STATS_BAR_CHART_HEIGHT,
    gap: 5,
  },
  plotDense: {
    gap: 2,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    marginLeft: 6,
    height: STATS_BAR_CHART_HEIGHT,
  },
  yTick: {
    position: "absolute",
    right: 0,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 12,
    fontFamily: fontFamily.bodyMedium,
    textAlign: "right",
  },
  axisRow: {
    flexDirection: "row",
    paddingRight: Y_AXIS_WIDTH + 6,
    gap: 5,
  },
  axisRowDense: {
    gap: 2,
  },
  column: {
    flex: 1,
    minWidth: 0,
    height: STATS_BAR_CHART_HEIGHT,
  },
  columnPressed: {
    opacity: motion.pressOpacity,
  },
  barSlot: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primary,
    transformOrigin: "bottom",
  },
  fillFit: {
    width: "58%",
    maxWidth: 22,
    minWidth: 8,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  fillDense: {
    width: "86%",
    maxWidth: 14,
    minWidth: 2,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  fillDimmed: {
    opacity: 0.42,
  },
  marker: {
    position: "absolute",
    top: 0,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
    opacity: 0.85,
  },
  markerSelected: {
    opacity: 1,
    transform: [{ scale: 1.2 }],
  },
  axisLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fontFamily.bodyMedium,
    textAlign: "center",
  },
  axisLabelDense: {
    fontSize: 10,
  },
});
