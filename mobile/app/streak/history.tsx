import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import type { StreakRunDto } from "../../types/streak";

function formatRange(startIso: string, endIso: string): string {
  try {
    const s = new Date(`${startIso}T12:00:00Z`);
    const e = new Date(`${endIso}T12:00:00Z`);
    const same = startIso === endIso;
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    if (same) return s.toLocaleDateString(undefined, opts);
    return `${s.toLocaleDateString(undefined, opts)} → ${e.toLocaleDateString(undefined, opts)}`;
  } catch {
    return `${startIso} → ${endIso}`;
  }
}

export default function StreakHistoryScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [runs, setRuns] = useState<StreakRunDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setRuns([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await apiJson<StreakRunDto[]>("/streak/history", { token });
      setRuns(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load streak history.");
      setRuns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().catch(() => undefined);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            router.back();
          }}
        >
          <ChevronLeft color={colors.textPrimary} size={26} />
        </Pressable>
        <Text style={styles.title}>Streak history</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.muted}>Loading runs…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => load().catch(() => undefined)}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && runs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>No streak runs yet</Text>
            <Text style={styles.emptySub}>Complete sessions on consecutive days to build your first chain.</Text>
          </View>
        ) : null}

        {runs.map((run, i) => (
          <Animated.View key={`${run.start_date}-${run.end_date}-${i}`} entering={FadeInDown.delay(i * 40).duration(360)}>
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.days}>{run.length_days}</Text>
                <Text style={styles.daysLabel}>day{run.length_days === 1 ? "" : "s"}</Text>
              </View>
              <Text style={styles.range}>{formatRange(run.start_date, run.end_date)}</Text>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
  backSpacer: { width: 44 },
  pressed: { opacity: 0.85 },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  center: { paddingVertical: spacing.xl, alignItems: "center", gap: spacing.sm },
  muted: { color: colors.textSecondary, ...typography.caption },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,80,80,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.25)",
    marginBottom: spacing.md,
  },
  errorText: { color: "#ff9a9a", ...typography.caption, marginBottom: spacing.sm },
  retry: { alignSelf: "flex-start", paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  retryText: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  empty: { alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
    marginBottom: spacing.xs,
  },
  emptySub: { color: colors.textSecondary, ...typography.body, textAlign: "center" },
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardTop: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs, marginBottom: spacing.xs },
  days: {
    fontSize: 36,
    lineHeight: 40,
    fontFamily: fontFamily.heading,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  daysLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  range: { color: colors.textSecondary, ...typography.body },
});
