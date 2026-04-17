import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StatCard } from "../../components/ui/StatCard";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

const FILTERS = ["Week", "Month", "All"] as const;

const trendData = [
  20, 32, 24, 48, 51, 43, 62,
];

const breakdownData = [
  { label: "Beat", value: 50, color: colors.primary },
  { label: "Mix", value: 30, color: colors.secondary },
  { label: "Sound", value: 20, color: colors.success },
];

export default function StatsScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Week");
  const [refreshing, setRefreshing] = useState(false);

  const summary = useMemo(
    () => ({
      hours: filter === "Week" ? "12.4h" : filter === "Month" ? "48.1h" : "132.7h",
      sessions: filter === "Week" ? "14" : filter === "Month" ? "52" : "180",
      bestStreak: "9",
    }),
    [filter]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 550));
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Your Stats</Text>
          <View style={styles.filterRow}>
            {FILTERS.map((item) => (
              <Pressable key={item} style={[styles.filterChip, filter === item && styles.filterChipActive]} onPress={() => setFilter(item)}>
                <Text style={[styles.filterLabel, filter === item && styles.filterLabelActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
          <StatCard label="Total Time" value={summary.hours} />
          <StatCard label="Total Sessions" value={summary.sessions} />
          <StatCard label="Best Streak" value={summary.bestStreak} />
        </ScrollView>

        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Sessions Over Time</Text>
          <View style={styles.sparklineWrap}>
            {trendData.map((value, idx) => (
              <View key={idx} style={styles.sparkItem}>
                <View style={[styles.sparkBar, { height: value * 1.7 }]} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Session Type Breakdown</Text>
          <View style={styles.breakdownWrap}>
            {breakdownData.map((item) => (
              <View key={item.label} style={styles.breakdownRow}>
                <View style={styles.breakdownLabelWrap}>
                  <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                  <Text style={styles.breakdownLabel}>{item.label}</Text>
                </View>
                <View style={styles.breakdownTrack}>
                  <View style={[styles.breakdownFill, { width: `${item.value}%`, backgroundColor: item.color }]} />
                </View>
                <Text style={styles.breakdownValue}>{item.value}%</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  headerRow: { marginBottom: spacing.md, gap: spacing.sm },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  filterRow: { flexDirection: "row", gap: spacing.sm },
  filterChip: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  filterChipActive: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.2)" },
  filterLabel: { color: colors.textSecondary, fontFamily: fontFamily.bodyMedium, ...typography.caption },
  filterLabelActive: { color: colors.textPrimary },
  cardRow: { gap: spacing.sm, paddingBottom: spacing.md },
  chartCard: {
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  cardTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  sparklineWrap: {
    marginTop: spacing.md,
    height: 140,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sparkItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  sparkBar: {
    width: "100%",
    maxWidth: 22,
    borderRadius: 8,
    backgroundColor: "rgba(255,61,0,0.75)",
  },
  breakdownWrap: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    width: 78,
    gap: spacing.xs,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  breakdownTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#222222",
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: 5,
  },
  breakdownValue: {
    color: colors.textSecondary,
    width: 40,
    textAlign: "right",
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
});
