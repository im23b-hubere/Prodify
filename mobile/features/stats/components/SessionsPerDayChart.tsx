import { LinearGradient } from "expo-linear-gradient";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, spacing } from "../../../constants/theme";
import { STATS_BAR_CHART_HEIGHT } from "../constants";
import type { BarPoint } from "../types";

type Props = {
  data: BarPoint[];
};

const WEEK_FIT_COUNT = 7;

export function SessionsPerDayChart({ data }: Props) {
  if (data.length === 0) return null;
  const maxY = Math.max(1, ...data.map((point) => point.y));
  const todayIso = new Date().toISOString().slice(0, 10);
  const columns = data.map((point) => (
    <ChartColumn key={point.label} point={point} maxY={maxY} todayIso={todayIso} fit />
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
        <ChartColumn point={point} maxY={maxY} todayIso={todayIso} fit={false} />
      )}
    />
  );
}

function ChartColumn({
  point,
  maxY,
  todayIso,
  fit,
}: {
  point: BarPoint;
  maxY: number;
  todayIso: string;
  fit: boolean;
}) {
  const height = Math.max(3, (point.y / maxY) * STATS_BAR_CHART_HEIGHT);
  const isToday = point.label === todayIso;
  return (
    <View style={[styles.column, fit ? styles.columnFit : styles.columnFixed]}>
      <View style={styles.track}>
        <LinearGradient
          colors={isToday ? ["#ff8f66", colors.primary] : ["#ff5a1f", colors.primary]}
          style={[styles.fill, fit ? styles.fillFit : styles.fillFixed, { height }]}
        />
      </View>
      <Text style={styles.axisLabel} numberOfLines={1}>
        {point.x}
      </Text>
      <Text style={[styles.count, point.y > 0 && styles.countActive]}>{point.y}</Text>
    </View>
  );
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
  },
  fill: {
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
  count: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fontFamily.bodyMedium,
  },
  countActive: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
  },
});
