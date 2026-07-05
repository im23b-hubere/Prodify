import { LinearGradient } from "expo-linear-gradient";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, spacing } from "../../../constants/theme";
import { STATS_BAR_CHART_HEIGHT } from "../constants";
import type { BarPoint } from "../types";

type Props = {
  data: BarPoint[];
};

export function SessionsPerDayChart({ data }: Props) {
  if (data.length === 0) return null;
  const maxY = Math.max(1, ...data.map((d) => d.y));
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <FlatList
      horizontal
      nestedScrollEnabled={Platform.OS === "android"}
      data={data}
      keyExtractor={(d, i) => `${d.label}-${i}`}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      renderItem={({ item: d }) => {
        const h = Math.max(3, (d.y / maxY) * STATS_BAR_CHART_HEIGHT);
        const isToday = d.label === todayIso;
        return (
          <View style={styles.column}>
            <View style={styles.track}>
              <LinearGradient
                colors={isToday ? ["#ff8f66", colors.primary] : ["#ff5a1f", colors.primary]}
                style={[styles.fill, { height: h }]}
              />
            </View>
            <Text style={styles.axisLabel} numberOfLines={1}>
              {d.x}
            </Text>
            <Text style={[styles.count, d.y > 0 && styles.countActive]}>{d.y}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: spacing.xs,
    paddingBottom: 2,
    paddingRight: spacing.sm,
  },
  column: {
    width: 44,
    alignItems: "center",
  },
  track: {
    height: STATS_BAR_CHART_HEIGHT,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  fill: {
    width: 28,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  axisLabel: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: fontFamily.body,
    maxWidth: 40,
    textAlign: "center",
  },
  count: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fontFamily.bodyMedium,
  },
  countActive: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
  },
});
