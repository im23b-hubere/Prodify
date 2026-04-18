import { useFocusEffect } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { Bell, ChevronUp, Flame } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector, Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { SessionSetupForm } from "../../components/session/SessionSetupForm";
import { StreakBreakModal } from "../../components/streak/StreakBreakModal";
import { StreakHeroSection } from "../../components/streak/StreakHeroSection";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { TutorialOverlay } from "../../components/TutorialOverlay";
import { PENDING_SESSION_SETUP_KEY } from "../../constants/sessionUi";
import { LAST_KNOWN_STREAK_KEY, MILESTONE_CELEBRATED_MAX_KEY } from "../../constants/storageKeys";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { STREAK_MILESTONES } from "../../lib/streakMilestones";
import { syncStreakRiskNotifications } from "../../lib/streakNotifications";
import { effectiveElapsedSeconds, formatDurationWords } from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";
import type { StreakOverviewDto } from "../../types/streak";

const SCREEN_HEIGHT = Dimensions.get("window").height;

function parseApiDate(value: string) {
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

function formatTimer(totalSeconds: number) {
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatNaturalCounting(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 1) return "Just getting started…";
  return `${mins} minute${mins === 1 ? "" : "s"} and counting…`;
}

function notesPreview(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  const t = notes.trim();
  if (t.length <= 50) return t;
  return `${t.slice(0, 50)}…`;
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
  const [setupVisible, setSetupVisible] = useState(false);
  const [setupModalKey, setSetupModalKey] = useState(0);
  const [stopBusy, setStopBusy] = useState(false);
  const [streakOverview, setStreakOverview] = useState<StreakOverviewDto | null>(null);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [breakModalStreak, setBreakModalStreak] = useState(0);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);

  const sheetTranslateY = useSharedValue(SCREEN_HEIGHT);
  const ringPulse = useSharedValue(1);

  const weekProgress = useMemo(() => getLast7DaysProgress(sessions), [sessions]);
  const clientStreak = useMemo(() => getStreak(sessions), [sessions]);
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

  const loadStreakOverview = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiJson<StreakOverviewDto>("/streak/overview", { token });
      setStreakOverview(data);
      await syncStreakRiskNotifications(data.streak_at_risk, data.current_streak);
    } catch {
      setStreakOverview(null);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSessions(), loadStreakOverview()])
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [loadSessions, loadStreakOverview]);

  useFocusEffect(
    useCallback(() => {
      loadSessions().catch(() => null);
      loadStreakOverview().catch(() => null);
      (async () => {
        try {
          const v = await SecureStore.getItemAsync(PENDING_SESSION_SETUP_KEY);
          if (v === "1") {
            await SecureStore.deleteItemAsync(PENDING_SESSION_SETUP_KEY);
            sheetTranslateY.value = SCREEN_HEIGHT;
            setSetupModalKey((k) => k + 1);
            setSetupVisible(true);
          }
        } catch {
          /* ignore */
        }
      })();
    }, [loadSessions, loadStreakOverview])
  );

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) {
      ringPulse.value = 1;
      return;
    }
    ringPulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 1100 }), withTiming(1, { duration: 1100 })),
      -1,
      true
    );
  }, [active, ringPulse]);

  useEffect(() => {
    if (!setupVisible) return;
    sheetTranslateY.value = SCREEN_HEIGHT;
    sheetTranslateY.value = withSpring(0, { damping: 22, stiffness: 260 });
  }, [setupVisible, sheetTranslateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));
  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringPulse.value }],
    opacity: 0.45 + 0.35 * (ringPulse.value - 1),
  }));

  const closeSetupModal = useCallback(
    (after?: () => void) => {
      sheetTranslateY.value = withTiming(SCREEN_HEIGHT * 1.08, { duration: 320 }, (finished) => {
        if (finished) {
          runOnJS(() => {
            setSetupVisible(false);
            after?.();
          })();
        }
      });
    },
    [sheetTranslateY]
  );

  const openSetup = useCallback(() => {
    if (active) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    sheetTranslateY.value = SCREEN_HEIGHT;
    setSetupModalKey((k) => k + 1);
    setSetupVisible(true);
  }, [active, sheetTranslateY]);

  const openFullscreenActive = useCallback(() => {
    if (!active) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    router.push({ pathname: "/session/active", params: { id: String(active.id), source: "dashboard" } });
  }, [active, router]);

  const swipeUpGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(-16)
        .failOffsetX([-24, 24])
        .onEnd((e) => {
          if (e.translationY < -40) {
            runOnJS(openFullscreenActive)();
          }
        }),
    [openFullscreenActive]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await Promise.all([loadSessions().catch(() => undefined), loadStreakOverview().catch(() => undefined)]);
    setRefreshing(false);
  }, [loadSessions, loadStreakOverview]);

  const weekDayLetters = useMemo(() => {
    const letters = ["M", "T", "W", "T", "F", "S", "S"];
    const out: string[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const wd = d.getDay();
      out.push(letters[wd === 0 ? 6 : wd - 1]);
    }
    return out;
  }, []);

  const displayOverview = useMemo((): StreakOverviewDto | null => {
    if (streakOverview) return streakOverview;
    if (loading) return null;
    const nm = STREAK_MILESTONES.find((m) => clientStreak < m.days);
    return {
      current_streak: clientStreak,
      longest_streak: clientStreak,
      last_7_day_states: weekProgress.map((w) => (w ? "session" : "none")) as ("session" | "freeze" | "none")[],
      last_7_day_labels: weekDayLetters,
      next_milestone_at: nm ? nm.days : null,
      next_milestone_title: nm ? nm.title : null,
      days_to_next_milestone: nm ? nm.days - clientStreak : null,
      freezes_remaining: 0,
      can_use_freeze: false,
      streak_at_risk: false,
      tagline: "Connect to unlock Streak Freeze and sync milestones.",
    };
  }, [streakOverview, loading, clientStreak, weekProgress, weekDayLetters]);

  const onUseFreeze = useCallback(async () => {
    if (!token) return;
    setFreezeBusy(true);
    try {
      await apiJson("/streak/freeze", { token, method: "POST", body: {} });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await loadStreakOverview();
      await loadSessions();
      Alert.alert("Streak Freeze", "You're safe for today. Your streak is protected.");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      Alert.alert("Couldn't activate freeze", e instanceof Error ? e.message : "Try again.");
    } finally {
      setFreezeBusy(false);
    }
  }, [token, loadStreakOverview, loadSessions]);

  useEffect(() => {
    if (!streakOverview) return;
    const cur = streakOverview.current_streak;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(MILESTONE_CELEBRATED_MAX_KEY);
        const maxSeen = raw ? parseInt(raw, 10) : 0;
        const newlyPassed = STREAK_MILESTONES.filter((m) => cur >= m.days && m.days > maxSeen);
        const best = newlyPassed.length ? newlyPassed[newlyPassed.length - 1] : null;
        if (best) {
          await SecureStore.setItemAsync(MILESTONE_CELEBRATED_MAX_KEY, String(best.days));
          setMilestoneToast(`${best.title} — ${best.reward}`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          }, 120);
          setTimeout(() => setMilestoneToast(null), 4200);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [streakOverview]);

  useEffect(() => {
    if (!streakOverview) return;
    const cur = streakOverview.current_streak;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(LAST_KNOWN_STREAK_KEY);
        const prev = raw ? parseInt(raw, 10) : 0;
        if (prev > 0 && cur === 0) {
          setBreakModalStreak(prev);
          setBreakModalOpen(true);
        }
        await SecureStore.setItemAsync(LAST_KNOWN_STREAK_KEY, String(cur));
      } catch {
        /* ignore */
      }
    })();
  }, [streakOverview]);

  const confirmStop = useCallback(() => {
    if (!active || !token) return;
    const elapsed = effectiveElapsedSeconds(active, Date.now());
    Alert.alert("End session?", `You worked for ${formatDurationWords(elapsed)}.`, [
      { text: "Keep going", style: "cancel" },
      {
        text: "End session",
        style: "destructive",
        onPress: async () => {
          setStopBusy(true);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            await apiJson<SessionDto>("/sessions/stop", {
              token,
              method: "POST",
              body: { session_id: active.id },
            });
            router.replace({ pathname: "/session/complete", params: { id: String(active.id) } });
          } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
            setError(e instanceof Error ? e.message : "Stop failed");
          } finally {
            setStopBusy(false);
          }
        },
      },
    ]);
  }, [active, token, router]);

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

  const preview = notesPreview(active?.notes);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TutorialOverlay />
      {milestoneToast ? (
        <Animated.View entering={FadeInUp.duration(320)} style={styles.milestoneToast}>
          <LinearGradient colors={["#ff6a3d", "#a259ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.milestoneToastInner}>
            <Text style={styles.milestoneToastText}>🏆 {milestoneToast}</Text>
          </LinearGradient>
        </Animated.View>
      ) : null}
      <StreakBreakModal
        visible={breakModalOpen}
        brokenStreak={breakModalStreak}
        onStartFresh={() => {
          setBreakModalOpen(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        }}
      />
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

            <StreakHeroSection
              overview={displayOverview}
              loading={loading}
              freezeBusy={freezeBusy}
              onUseFreeze={onUseFreeze}
            />

            {active ? (
              <GestureDetector gesture={swipeUpGesture}>
                <View style={styles.activeSessionBlock}>
                  <View style={styles.badgeRow}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{active.session_type || "Session"}</Text>
                    </View>
                  </View>

                  <View style={styles.timerRingWrap}>
                    <Animated.View style={[styles.pulseRingOuter, ringAnimatedStyle]} />
                    <LinearGradient colors={["#2a1410", "#1a1a1a"]} style={styles.timerInner}>
                      <Text style={styles.heroTimer}>{formatTimer(activeSeconds)}</Text>
                      <Text style={styles.elapsedNatural}>{formatNaturalCounting(activeSeconds)}</Text>
                      {preview ? (
                        <Text style={styles.notesPreview} numberOfLines={2}>
                          {preview}
                        </Text>
                      ) : null}
                      <View style={styles.swipeHint}>
                        <ChevronUp color={colors.textSecondary} size={16} />
                        <Text style={styles.swipeHintText}>Swipe up for focus mode</Text>
                      </View>
                    </LinearGradient>
                  </View>

                  <Pressable
                    style={({ pressed }) => [styles.stopSessionBtn, pressed && styles.pressedStop]}
                    onPress={confirmStop}
                    disabled={stopBusy}
                  >
                    <Text style={styles.stopSessionLabel}>{stopBusy ? "Stopping…" : "STOP SESSION"}</Text>
                  </Pressable>
                </View>
              </GestureDetector>
            ) : (
              <Pressable onPress={openSetup} style={({ pressed }) => [pressed && styles.pressedStart]}>
                <LinearGradient colors={["#ff6a3d", colors.primary]} style={styles.startCircle}>
                  <Text style={styles.tapLabel}>START SESSION</Text>
                  <Text style={styles.tapHint}>Set type, mood & notes</Text>
                </LinearGradient>
              </Pressable>
            )}

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
                <PrimaryButton
                  label="Retry"
                  onPress={() => {
                    Promise.all([loadSessions().catch(() => undefined), loadStreakOverview().catch(() => undefined)]);
                  }}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading && visibleSessions.length === 0 && !active ? (
            <View style={styles.emptyCard}>
              <Flame color={colors.primary} size={48} style={{ alignSelf: "center", marginBottom: spacing.sm }} />
              <Text style={styles.emptyTitle}>Start your first session to begin your streak! 🔥</Text>
              <PrimaryButton label="Start session" onPress={openSetup} />
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContainer}
        renderItem={renderItem}
      />

      <Modal
        visible={setupVisible}
        transparent
        animationType="none"
        onRequestClose={() => closeSetupModal()}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => closeSetupModal()} />
          <Animated.View style={[styles.modalSheet, sheetStyle]}>
            <SafeAreaView style={styles.modalSafe} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>New Session</Text>
                <Pressable
                  hitSlop={12}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                    closeSetupModal();
                  }}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </Pressable>
              </View>
              <SessionSetupForm
                key={setupModalKey}
                hideTitleRow
                onStarted={() => {
                  closeSetupModal(() => {
                    Promise.all([loadSessions().catch(() => null), loadStreakOverview().catch(() => null)]);
                  });
                }}
              />
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  milestoneToast: {
    position: "absolute",
    top: 8,
    left: spacing.md,
    right: spacing.md,
    zIndex: 40,
  },
  milestoneToastInner: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  milestoneToastText: {
    color: "#ffffff",
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    textAlign: "center",
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
  activeSessionBlock: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  badgeRow: {
    alignItems: "center",
  },
  typeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,61,0,0.18)",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  typeBadgeText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    letterSpacing: 0.4,
  },
  timerRingWrap: {
    alignSelf: "center",
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRingOuter: {
    position: "absolute",
    width: 268,
    height: 268,
    borderRadius: 134,
    borderWidth: 3,
    borderColor: "rgba(255,68,68,0.9)",
    shadowColor: "#ff4444",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  timerInner: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  heroTimer: {
    fontSize: 52,
    lineHeight: 56,
    fontFamily: fontFamily.heading,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  elapsedNatural: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.body,
    textAlign: "center",
  },
  notesPreview: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
  },
  swipeHint: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    opacity: 0.85,
  },
  swipeHintText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontSize: 12,
  },
  stopSessionBtn: {
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,68,68,0.18)",
    borderWidth: 2,
    borderColor: colors.danger,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.button,
  },
  pressedStop: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  stopSessionLabel: {
    color: colors.danger,
    fontFamily: fontFamily.heading,
    fontSize: 18,
    letterSpacing: 0.8,
  },
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
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  modalSheet: {
    maxHeight: SCREEN_HEIGHT * 0.94,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  modalSafe: {
    flex: 1,
    maxHeight: SCREEN_HEIGHT * 0.94,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCloseText: { color: colors.textPrimary, fontSize: 18, fontFamily: fontFamily.bodyBold },
});
