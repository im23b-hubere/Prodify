import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Bell, Flame } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { GlassCard } from "../../components/ui/GlassCard";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SessionTypeChip } from "../../components/ui/SessionTypeChip";
import { WeekProgressDots } from "../../components/ui/WeekProgressDots";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { SESSION_TYPES, type SessionDto, type SessionType } from "../../types/session";

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
  const [selectedType, setSelectedType] = useState<SessionType>("Beat Making");
  const [sessionNote, setSessionNote] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);

  const streak = useMemo(() => getStreak(sessions), [sessions]);
  const weekProgress = useMemo(() => getLast7DaysProgress(sessions), [sessions]);
  const visibleSessions = useMemo(() => sessions.filter((session) => session.stopped_at !== null), [sessions]);
  const activeSeconds = useMemo(() => {
    if (!active) return 0;
    return Math.max(0, Math.floor((nowMs - parseApiDate(active.started_at).getTime()) / 1000));
  }, [active, nowMs]);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    const list = await apiJson<SessionDto[]>("/sessions/list", { token });
    setSessions(list);
    setActive(list.find((item) => item.stopped_at === null) ?? null);
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
  const buttonRotateStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions().catch(() => undefined);
    setRefreshing(false);
  }, [loadSessions]);

  const startSession = useCallback(async () => {
    if (!token || busy || active) return;
    setBusy(true);
    setError(null);
    rotate.value = withSpring(360, { damping: 12 }, () => {
      rotate.value = 0;
    });
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      await apiJson("/sessions/start", {
        token,
        method: "POST",
        body: {
          session_type: selectedType,
          notes: sessionNote.trim() ? sessionNote.trim() : undefined,
        },
      });
      setSessionNote("");
      await loadSessions();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Start failed";
      if (msg.toLowerCase().includes("already have an active session")) {
        await loadSessions().catch(() => undefined);
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [active, busy, loadSessions, rotate, selectedType, token]);

  const stopSession = useCallback(async () => {
    if (!token || busy || !active) return;
    setBusy(true);
    setError(null);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await apiJson("/sessions/stop", { token, method: "POST", body: { session_id: active.id } });
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stop failed");
    } finally {
      setBusy(false);
    }
  }, [active, busy, loadSessions, token]);

  const dismissSession = useCallback(
    async (id: number) => {
      if (!token) return;
      Haptics.selectionAsync().catch(() => undefined);
      try {
        await apiJson(`/sessions/item/${id}`, { token, method: "DELETE" });
        await loadSessions();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    },
    [loadSessions, token]
  );

  const renderRightActions = (id: number) => (
    <Pressable style={styles.deleteAction} onPress={() => dismissSession(id).catch(() => undefined)}>
      <Text style={styles.deleteActionText}>Delete</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={visibleSessions}
        keyExtractor={(item) => String(item.id)}
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
                    <Text style={styles.streakLabel}>Day Streak</Text>
                    <WeekProgressDots activeDays={weekProgress} />
                  </View>
                </GlassCard>
              </Animated.View>
            ) : null}

            <Animated.View style={[styles.sessionCircleWrap, buttonRotateStyle]}>
              {!active ? (
                <Pressable onPress={startSession} disabled={busy || loading}>
                  <LinearGradient colors={["#ff6a3d", colors.primary]} style={styles.sessionCircle}>
                    <Text style={styles.tapLabel}>TAP TO START</Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable onPress={stopSession} disabled={busy}>
                  <View style={[styles.sessionCircle, styles.sessionCircleActive]}>
                    <Text style={styles.timerLabel}>{formatTimer(activeSeconds)}</Text>
                    <Text style={styles.stopLabel}>STOP</Text>
                  </View>
                </Pressable>
              )}
            </Animated.View>

            <View style={styles.chipsRow}>
              {SESSION_TYPES.map((type) => (
                <SessionTypeChip key={type} label={type} active={selectedType === type} onPress={() => setSelectedType(type)} />
              ))}
            </View>
            {!active ? (
              <TextInput
                style={styles.noteInput}
                placeholder="Optional note (project, mood, focus)"
                placeholderTextColor={colors.textSecondary}
                value={sessionNote}
                onChangeText={setSessionNote}
              />
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Sessions</Text>
              <Pressable onPress={() => router.push("/(tabs)/session-trash")}>
                <Text style={styles.trashLink}>Trash</Text>
              </Pressable>
            </View>
            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
                <PrimaryButton label="Retry" onPress={() => loadSessions().catch(() => undefined)} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No sessions yet - start producing!</Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(100 + index * 70).duration(400)}>
            <Swipeable renderRightActions={() => renderRightActions(item.id)}>
              <Pressable
                style={styles.sessionRow}
                onPress={() => router.push({ pathname: "/(tabs)/session/[id]", params: { id: String(item.id) } })}
              >
                <Text style={styles.sessionType}>{item.session_type || "Beat Making"}</Text>
                <Text style={styles.sessionMeta}>{Math.round((item.duration_seconds ?? 0) / 60)} min</Text>
              </Pressable>
            </Swipeable>
          </Animated.View>
        )}
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
  sessionCircleWrap: {
    alignSelf: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  sessionCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.button,
  },
  sessionCircleActive: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  tapLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    letterSpacing: 1.5,
    ...typography.subheadline,
  },
  timerLabel: {
    color: colors.textPrimary,
    fontSize: 44,
    fontFamily: fontFamily.heading,
  },
  stopLabel: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  chipsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  noteInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    fontFamily: fontFamily.body,
    ...typography.caption,
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
