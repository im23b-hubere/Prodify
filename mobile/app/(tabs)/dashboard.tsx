import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Bell, Flame } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { GlassCard } from "../../components/ui/GlassCard";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { TutorialOverlay } from "../../components/TutorialOverlay";
import { WeekProgressDots } from "../../components/ui/WeekProgressDots";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { effectiveElapsedSeconds } from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";

function parseApiDate(value: string) {
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

function formatTimer(totalSeconds: number) {
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function toDateKey(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getStreak(sessions: SessionDto[]) {
  const dayKeys = Array.from(new Set(sessions.map((session) => toDateKey(parseApiDate(session.started_at))))).sort();
  if (dayKeys.length === 0) return 0;
  const set = new Set(dayKeys);
  let streak = 0;
  const cursor = new Date();
  if (!set.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(toDateKey(cursor))) return 0;
  }
  while (set.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getLast7DaysProgress(sessions: SessionDto[]) {
  const set = new Set(sessions.map((session) => toDateKey(parseApiDate(session.started_at))));
  const result: boolean[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(set.has(toDateKey(d)));
  }
  return result;
}

function SessionSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonRow} />
      <View style={styles.skeletonRow} />
      <View style={styles.skeletonRowShort} />
    </View>
  );
}

export default function DashboardScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [active, setActive] = useState<SessionDto | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const pulse = useSharedValue(1);

  const streak = useMemo(() => getStreak(sessions), [sessions]);
  const weekProgress = useMemo(() => getLast7DaysProgress(sessions), [sessions]);
  const visibleSessions = useMemo(() => sessions.filter((session) => session.stopped_at !== null), [sessions]);
  const activeSeconds = useMemo(() => {
    if (!active) return 0;
    return effectiveElapsedSeconds(active, nowMs);
  }, [active, nowMs]);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    const list = await apiJson<SessionDto[]>("/sessions/list", { token });
    setSessions(list);
    let running = list.find((item) => item.stopped_at === null) ?? null;
    if (!running) {
      try {
        running = await apiJson<SessionDto>("/sessions/active", { token });
      } catch {
        running = null;
      }
    }
    setActive(running);
    setLastUpdated(new Date());
  }, [token]);

  useEffect(() => {
    setLoading(true);
    loadSessions()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load sessions"))
      .finally(() => setLoading(false));
  }, [loadSessions]);

  useFocusEffect(
    useCallback(() => {
      loadSessions().catch(() => null);
    }, [loadSessions])
  );

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.08, { duration: 1000 }), -1, true);
  }, [pulse]);

  const streakPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await loadSessions().catch(() => undefined);
    setRefreshing(false);
  }, [loadSessions]);

  const goSetup = useCallback(() => {
    if (active) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    router.push("/session/setup");
  }, [active, router]);

  const goActive = useCallback(() => {
    if (!active) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.push({ pathname: "/session/active", params: { id: String(active.id) } });
  }, [active, router]);

  const dismissSession = useCallback(
    async (sessionId: number) => {
      if (!token) return;
      Haptics.selectionAsync().catch(() => undefined);
      try {
        await apiJson(`/sessions/item/${sessionId}`, { token, method: "DELETE" });
        await loadSessions();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    },
    [loadSessions, token]
  );

  const renderRightActions = useCallback(
    (sessionId: number) => (
      <Pressable style={styles.deleteAction} onPress={() => dismissSession(sessionId).catch(() => undefined)}>
        <Text style={styles.deleteActionText}>Delete</Text>
      </Pressable>
    ),
    [dismissSession]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: SessionDto; index: number }) => (
      <Animated.View entering={FadeInUp.delay(100 + index * 70).duration(400)}>
        <Swipeable renderRightActions={() => renderRightActions(item.id)}>
          <Pressable
            style={styles.sessionRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              router.push(`/session/${item.id}`);
            }}
          >
            <Text style={styles.sessionType}>{item.session_type || "Beat Making"}</Text>
            <Text style={styles.sessionMeta}>{Math.round((item.duration_seconds ?? 0) / 60)} min</Text>
          </Pressable>
        </Swipeable>
      </Animated.View>
    ),
    [renderRightActions, router]
  );

  const lastUpdatedLabel = lastUpdated
    ? `Updated ${Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 60000))}m ago`
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TutorialOverlay />
      <FlatList
        data={visibleSessions}
        keyExtractor={(item) => `session-${item.id}`}
        removeClippedSubviews
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={8}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.topBar}>
              <Text style={styles.username}>Hey, {user?.username ?? "Producer"}</Text>
              <Pressable style={styles.iconButton}>
                <Bell color={colors.textPrimary} size={20} />
              </Pressable>
            </View>

            {loading ? <SessionSkeleton /> : null}

            {!loading ? (
              <Animated.View entering={FadeInUp.duration(500)}>
                <GlassCard>
                  <View style={styles.streakCenter}>
                    <Animated.View style={streakPulseStyle}>
                      <Flame color={colors.primary} size={40} />
                    </Animated.View>
                    <Text style={styles.streakNumber}>{streak}</Text>
                    <Text style={styles.streakLabel}>Day streak</Text>
                    <WeekProgressDots activeDays={weekProgress} />
                  </View>
                </GlassCard>
              </Animated.View>
            ) : null}

            {active ? (
              <Pressable style={styles.activeBanner} onPress={goActive}>
                <View>
                  <Text style={styles.activeBannerTitle}>Session in progress</Text>
                  <Text style={styles.activeBannerSub}>{formatTimer(activeSeconds)} · tap to continue</Text>
                </View>
                <Text style={styles.activeBannerChev}>›</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={goSetup} disabled={!!active} style={({ pressed }) => [pressed && styles.pressedStart]}>
              <LinearGradient colors={["#ff6a3d", colors.primary]} style={styles.startCircle}>
                <Text style={styles.tapLabel}>START SESSION</Text>
                <Text style={styles.tapHint}>Set type, mood & notes</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent sessions</Text>
              <Pressable onPress={() => router.push("/(tabs)/session-trash")}>
                <Text style={styles.trashLink}>Trash</Text>
              </Pressable>
            </View>
            {lastUpdatedLabel ? <Text style={styles.updatedHint}>{lastUpdatedLabel}</Text> : null}
            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
                <PrimaryButton label="Retry" onPress={() => loadSessions().catch(() => undefined)} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <Flame color={colors.primary} size={48} style={{ alignSelf: "center", marginBottom: spacing.sm }} />
              <Text style={styles.emptyTitle}>Start your first session to begin your streak! 🔥</Text>
              <PrimaryButton label="Start session" onPress={goSetup} />
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContainer}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  headerContent: {
    paddingTop: spacing.sm,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  username: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  streakCenter: {
    alignItems: "center",
    gap: spacing.sm,
  },
  streakNumber: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 72,
    lineHeight: 74,
  },
  streakLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  activeBannerTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  activeBannerSub: { color: colors.textSecondary, ...typography.caption, marginTop: 4 },
  activeBannerChev: { color: colors.primary, fontSize: 28, fontFamily: fontFamily.heading },
  pressedStart: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  startCircle: {
    alignSelf: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    ...shadows.button,
  },
  tapLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    letterSpacing: 1.2,
    ...typography.subheadline,
    textAlign: "center",
  },
  tapHint: {
    marginTop: spacing.xs,
    color: "rgba(255,255,255,0.85)",
    ...typography.caption,
    textAlign: "center",
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.subheadline,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  updatedHint: {
    color: colors.textSecondary,
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  trashLink: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  sessionRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    ...shadows.card,
  },
  sessionType: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
  },
  sessionMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  deleteActionText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  emptyCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  emptyTitle: {
    color: colors.textSecondary,
    textAlign: "center",
    fontFamily: fontFamily.body,
    ...typography.body,
  },
  errorCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  skeletonWrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  skeletonRow: {
    height: 16,
    borderRadius: 8,
    backgroundColor: "#242424",
  },
  skeletonRowShort: {
    height: 16,
    width: "60%",
    borderRadius: 8,
    backgroundColor: "#242424",
  },
});
