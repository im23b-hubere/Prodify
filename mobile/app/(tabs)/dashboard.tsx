import { useFocusEffect } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { Bell, Flame } from "lucide-react-native";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
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

import { DashboardMotivationCard } from "../../components/dashboard/DashboardMotivationCard";
import { DashboardSessionStarter } from "../../components/dashboard/DashboardSessionStarter";
import { FriendsActivityWidget } from "../../components/dashboard/FriendsActivityWidget";
import { TodayProgressCard } from "../../components/dashboard/TodayProgressCard";
import { SessionSetupForm } from "../../components/session/SessionSetupForm";
import { StreakBreakModal } from "../../components/streak/StreakBreakModal";
import { StreakHeroSection } from "../../components/streak/StreakHeroSection";
import { CrashBoundary } from "../../components/ui/CrashBoundary";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { TutorialOverlay } from "../../components/TutorialOverlay";
import { PENDING_SESSION_SETUP_KEY } from "../../constants/sessionUi";
import {
  LAST_KNOWN_STREAK_KEY,
  MILESTONE_CELEBRATED_MAX_KEY,
  userScopedLastKnownStreakKey,
  userScopedMilestoneCelebratedKey,
} from "../../constants/storageKeys";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { debugLog } from "../../lib/debugLog";
import {
  parseMotivationalMessage,
  translateMotivationalMessage,
  type MotivationalMessageDto,
} from "../../lib/motivationApi";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { parseSessionList, tryParseSessionDto } from "../../lib/sessionDto";
import {
  generateMotivationMessage,
  getTimeBasedGreeting,
  getTimeOfDay,
} from "../../lib/motivationEngine";
import { STREAK_MILESTONES } from "../../lib/streakMilestones";
import { getUnreadCount, prependNotification } from "../../lib/notificationInbox";
import { registerPushTokenWithBackend } from "../../lib/pushToken";
import { syncStreakRiskNotifications } from "../../lib/streakNotifications";
import { effectiveElapsedSeconds, formatDurationWords } from "../../lib/sessionTime";
import type { FriendActivityDto, FriendLeaderboardDto } from "../../types/friends";
import type { SessionDto } from "../../types/session";
import type { StreakOverviewDto } from "../../types/streak";

const SCREEN_HEIGHT = Dimensions.get("window").height;

function parseApiDate(value: string) {
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

function formatTimer(totalSeconds: number) {
  const s = Number.isFinite(totalSeconds) && totalSeconds >= 0 ? Math.floor(totalSeconds) : 0;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatNaturalCounting(totalSeconds: number, t: TFunction): string {
  const s = Number.isFinite(totalSeconds) && totalSeconds >= 0 ? totalSeconds : 0;
  const mins = Math.floor(s / 60);
  if (mins < 1) return t("dashboard.naturalCountingStart");
  return t("dashboard.naturalCountingMins", { count: mins, mins });
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
  const dayKeys = Array.from(
    new Set(
      sessions
        .map((session) => {
          if (!session.started_at?.trim()) return null;
          const d = parseApiDate(session.started_at);
          return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
        })
        .filter((k): k is string => k !== null),
    ),
  ).sort();
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
  const set = new Set(
    sessions
      .map((session) => {
        if (!session.started_at?.trim()) return null;
        const d = parseApiDate(session.started_at);
        return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
      })
      .filter((k): k is string => k !== null),
  );
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
  const { t } = useTranslation();
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
  const [notifUnread, setNotifUnread] = useState(0);
  const [friendActivity, setFriendActivity] = useState<FriendActivityDto[]>([]);
  const [friendLeaderboard, setFriendLeaderboard] = useState<FriendLeaderboardDto | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [weeklyGoalTarget, setWeeklyGoalTarget] = useState<number | null>(null);
  const [weekSessionsCount, setWeekSessionsCount] = useState(0);
  const [serverMotivationDto, setServerMotivationDto] = useState<MotivationalMessageDto | null>(null);
  const userScopedStreakKey = user?.id
    ? userScopedLastKnownStreakKey(user.id)
    : LAST_KNOWN_STREAK_KEY;
  const userScopedMilestoneKey = user?.id
    ? userScopedMilestoneCelebratedKey(user.id)
    : MILESTONE_CELEBRATED_MAX_KEY;

  const loadSessionsSeq = useRef(0);
  const loadStreakSeq = useRef(0);
  const stopSessionInFlight = useRef(false);

  const sheetTranslateY = useSharedValue(SCREEN_HEIGHT);
  const ringPulse = useSharedValue(1);

  const weekProgress = useMemo(() => getLast7DaysProgress(sessions), [sessions]);
  const clientStreak = useMemo(() => getStreak(sessions), [sessions]);
  const visibleSessions = useMemo(
    () => sessions.filter((session) => session.stopped_at !== null),
    [sessions],
  );
  const activeSeconds = useMemo(() => {
    if (!active) return 0;
    return effectiveElapsedSeconds(active, nowMs);
  }, [active, nowMs]);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    const seq = ++loadSessionsSeq.current;
    try {
      const listRaw = await apiJson<unknown>("/sessions/list", { token });
      if (seq !== loadSessionsSeq.current) return;
      const list = parseSessionList(listRaw);
      setSessions(list);
      let running = list.find((item) => item.stopped_at === null) ?? null;
      if (!running) {
        try {
          const activeRaw = await apiJson<unknown>("/sessions/active", { token });
          running = tryParseSessionDto(activeRaw);
        } catch {
          running = null;
        }
        if (seq !== loadSessionsSeq.current) return;
      }
      setActive(running);
      setLastUpdated(new Date());
    } catch (e) {
      if (seq !== loadSessionsSeq.current) return;
      setError(e instanceof Error ? e.message : t("dashboard.loadSessionsFailed"));
    }
  }, [token, t]);

  const loadSocial = useCallback(async () => {
    if (!token) return;
    setSocialLoading(true);
    try {
      const [lbRaw, actRaw, goalRaw] = await Promise.all([
        apiJson<unknown>("/friends/leaderboard?period=week", { token }),
        apiJson<unknown>("/friends/activity?limit=8", { token }),
        apiJson<unknown>("/goals/current", { token }),
      ]);
      const lb =
        lbRaw && typeof lbRaw === "object" && "entries" in lbRaw
          ? (lbRaw as FriendLeaderboardDto)
          : null;
      setFriendLeaderboard(lb);
      setFriendActivity(Array.isArray(actRaw) ? (actRaw as FriendActivityDto[]) : []);
      if (goalRaw && typeof goalRaw === "object") {
        const g = goalRaw as { target_value?: unknown; current_sessions?: unknown };
        const tv = typeof g.target_value === "number" ? g.target_value : null;
        const cs = typeof g.current_sessions === "number" ? g.current_sessions : 0;
        setWeeklyGoalTarget(tv);
        setWeekSessionsCount(cs);
      } else {
        setWeeklyGoalTarget(null);
        setWeekSessionsCount(0);
      }
    } catch {
      setFriendLeaderboard(null);
      setFriendActivity([]);
    } finally {
      setSocialLoading(false);
    }
  }, [token]);

  const loadStreakOverview = useCallback(async () => {
    if (!token) return;
    const seq = ++loadStreakSeq.current;
    try {
      const data = await apiJson<StreakOverviewDto>("/streak/overview", { token });
      if (seq !== loadStreakSeq.current) return;
      setStreakOverview(data);
      await syncStreakRiskNotifications(data.streak_at_risk, data.current_streak);
    } catch {
      if (seq !== loadStreakSeq.current) return;
      setStreakOverview(null);
    }
  }, [token]);

  const loadServerMotivation = useCallback(async () => {
    if (!token) {
      setServerMotivationDto(null);
      return;
    }
    try {
      const raw = await apiJson<unknown>("/motivational-messages/random", { token });
      const parsed = parseMotivationalMessage(raw);
      setServerMotivationDto(parsed);
    } catch {
      setServerMotivationDto(null);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSessions(), loadStreakOverview(), loadSocial(), loadServerMotivation()])
      .catch((e) => setError(e instanceof Error ? e.message : t("dashboard.loadFailed")))
      .finally(() => setLoading(false));
  }, [loadSessions, loadStreakOverview, loadSocial, loadServerMotivation, t]);

  useFocusEffect(
    useCallback(() => {
      loadSessions().catch(() => null);
      loadStreakOverview().catch(() => null);
      loadSocial().catch(() => null);
      loadServerMotivation().catch(() => null);
      getUnreadCount()
        .then(setNotifUnread)
        .catch(() => undefined);
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
    }, [loadSessions, loadStreakOverview, loadSocial, loadServerMotivation, sheetTranslateY]),
  );

  useEffect(() => {
    if (!token) return;
    registerPushTokenWithBackend(token).catch(() => undefined);
  }, [token]);

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
      true,
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
    [sheetTranslateY],
  );

  const openSetup = useCallback(() => {
    if (active) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    // Emergency fallback: avoid modal path and open dedicated setup screen.
    router.push("/session/setup");
  }, [active, router]);

  const openFullscreenActive = useCallback(() => {
    if (!active || typeof active.id !== "number" || !Number.isFinite(active.id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    router.push({
      pathname: "/session/active",
      params: { id: String(active.id), source: "dashboard" },
    });
  }, [active, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await Promise.all([
      loadSessions().catch(() => undefined),
      loadStreakOverview().catch(() => undefined),
      loadSocial().catch(() => undefined),
      loadServerMotivation().catch(() => undefined),
    ]);
    setRefreshing(false);
  }, [loadSessions, loadStreakOverview, loadSocial, loadServerMotivation]);

  const weekDayLetters = useMemo(() => {
    const letters = t("dashboard.weekdayShort", { returnObjects: true }) as string[];
    const safe = Array.isArray(letters) && letters.length === 7 ? letters : ["M", "T", "W", "T", "F", "S", "S"];
    const out: string[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const wd = d.getDay();
      out.push(safe[wd === 0 ? 6 : wd - 1] ?? "?");
    }
    return out;
  }, [t]);

  const todayStats = useMemo(() => {
    const key = toDateKey(new Date());
    const today = visibleSessions.filter((s) => {
      if (!s.started_at || s.stopped_at === null) return false;
      return toDateKey(parseApiDate(s.started_at)) === key;
    });
    const mins = Math.round(today.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0) / 60);
    return { count: today.length, minutes: mins };
  }, [visibleSessions]);

  const serverMotivationLine = useMemo(() => {
    if (!serverMotivationDto) return null;
    return translateMotivationalMessage(serverMotivationDto, t);
  }, [serverMotivationDto, t]);

  const motivationMessage = useMemo(() => {
    const streakVal = streakOverview?.current_streak ?? clientStreak;
    const last = visibleSessions[0];
    let top: { userId: number; name: string } | null = null;
    if (friendLeaderboard?.entries?.length) {
      const others = friendLeaderboard.entries.filter((e) => e.user_id !== user?.id);
      const sorted = [...others].sort((a, b) => b.sessions_in_period - a.sessions_in_period);
      const w = sorted[0];
      if (w) top = { userId: w.user_id, name: w.username };
    }
    const cutoff = Date.now() - 90 * 60 * 1000;
    const activeNow = friendActivity.filter(
      (a) =>
        user?.id != null && a.user_id !== user.id && new Date(a.completed_at).getTime() >= cutoff,
    ).length;
    return generateMotivationMessage({
      streak: streakVal,
      todayCount: todayStats.count,
      weekCount: weekSessionsCount,
      friends: { activeNow, topThisWeek: top },
      timeOfDay: getTimeOfDay(),
      lastSessionFocus: last?.focus_score ?? null,
    });
  }, [
    streakOverview?.current_streak,
    clientStreak,
    visibleSessions,
    friendLeaderboard,
    friendActivity,
    user?.id,
    todayStats.count,
    weekSessionsCount,
  ]);

  const recentSessions = useMemo(() => visibleSessions.slice(0, 3), [visibleSessions]);

  const displayOverview = useMemo((): StreakOverviewDto | null => {
    if (streakOverview) return streakOverview;
    if (loading) return null;
    const nm = STREAK_MILESTONES.find((m) => clientStreak < m.days);
    return {
      current_streak: clientStreak,
      longest_streak: clientStreak,
      last_7_day_states: weekProgress.map((w) => (w ? "session" : "none")) as (
        | "session"
        | "freeze"
        | "none"
      )[],
      last_7_day_labels: weekDayLetters,
      next_milestone_at: nm ? nm.days : null,
      next_milestone_title: nm ? nm.title : null,
      days_to_next_milestone: nm ? nm.days - clientStreak : null,
      freezes_remaining: 0,
      can_use_freeze: false,
      streak_at_risk: false,
      tagline: t("dashboard.streakFallbackTagline"),
    };
  }, [streakOverview, loading, clientStreak, weekProgress, weekDayLetters, t]);

  const onUseFreeze = useCallback(async () => {
    if (!token) return;
    setFreezeBusy(true);
    try {
      await apiJson("/streak/freeze", { token, method: "POST", body: {} });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await loadStreakOverview();
      await loadSessions();
      Alert.alert(t("dashboard.freezeSuccessTitle"), t("dashboard.freezeSuccessBody"));
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      Alert.alert(
        t("dashboard.freezeErrorTitle"),
        e instanceof Error ? e.message : t("dashboard.freezeTryAgain"),
      );
    } finally {
      setFreezeBusy(false);
    }
  }, [token, loadStreakOverview, loadSessions, t]);

  useEffect(() => {
    if (!streakOverview) return;
    const cur = streakOverview.current_streak;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(userScopedMilestoneKey);
        const maxSeen = raw ? parseInt(raw, 10) : 0;
        const newlyPassed = STREAK_MILESTONES.filter((m) => cur >= m.days && m.days > maxSeen);
        const best = newlyPassed.length ? newlyPassed[newlyPassed.length - 1] : null;
        if (best) {
          await SecureStore.setItemAsync(userScopedMilestoneKey, String(best.days));
          setMilestoneToast(`${best.title} — ${best.reward}`);
          prependNotification({
            category: "achievement",
            title: t("dashboard.milestoneNotifTitle"),
            body: `${best.title} — ${best.reward}`,
          }).catch(() => undefined);
          getUnreadCount()
            .then(setNotifUnread)
            .catch(() => undefined);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => undefined,
          );
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
          }, 120);
          setTimeout(() => setMilestoneToast(null), 4200);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [streakOverview, userScopedMilestoneKey, t]);

  useEffect(() => {
    if (!streakOverview) return;
    const cur = streakOverview.current_streak;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(userScopedStreakKey);
        const prev = raw ? parseInt(raw, 10) : 0;
        if (prev > 0 && cur === 0) {
          setBreakModalStreak(prev);
          setBreakModalOpen(true);
        }
        await SecureStore.setItemAsync(userScopedStreakKey, String(cur));
      } catch {
        /* ignore */
      }
    })();
  }, [streakOverview, userScopedStreakKey]);

  const confirmStop = useCallback(() => {
    if (!active || !token || stopSessionInFlight.current) return;
    const sessionToStop = active;
    const elapsed = effectiveElapsedSeconds(sessionToStop, Date.now());
    Alert.alert(
      t("dashboard.endSessionTitle"),
      t("dashboard.endSessionWorked", { duration: formatDurationWords(elapsed) }),
      [
      { text: t("dashboard.keepGoing"), style: "cancel" },
      {
        text: t("dashboard.endSessionConfirm"),
        style: "destructive",
        onPress: async () => {
          if (stopSessionInFlight.current) return;
          stopSessionInFlight.current = true;
          setStopBusy(true);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
            debugLog("session", "stop_attempt", { sessionId: sessionToStop.id });
            await apiJson<SessionDto>("/sessions/stop", {
              token,
              method: "POST",
              body: { session_id: sessionToStop.id },
            });
            debugLog("session", "stop_success", { sessionId: sessionToStop.id });
            setActive(null);
            router.replace({
              pathname: "/session/complete",
              params: { id: String(sessionToStop.id) },
            });
          } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
              () => undefined,
            );
            const msg = e instanceof Error ? e.message : t("dashboard.stopFailed");
            debugLog("session", "stop_failure", { sessionId: sessionToStop.id, message: msg });
            setError(msg);
            await loadSessions().catch(() => undefined);
          } finally {
            stopSessionInFlight.current = false;
            setStopBusy(false);
          }
        },
      },
    ]);
  }, [active, token, router, loadSessions, t]);

  const dismissSession = useCallback(
    async (sessionId: number) => {
      if (!token) return;
      Haptics.selectionAsync().catch(() => undefined);
      try {
        await apiJson(`/sessions/item/${sessionId}`, { token, method: "DELETE" });
        await loadSessions();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("dashboard.deleteFailed"));
      }
    },
    [loadSessions, token, t],
  );

  const renderRightActions = useCallback(
    (sessionId: number) => (
      <Pressable
        style={styles.deleteAction}
        onPress={() => dismissSession(sessionId).catch(() => undefined)}
      >
        <Text style={styles.deleteActionText}>{t("dashboard.deleteSwipe")}</Text>
      </Pressable>
    ),
    [dismissSession, t],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: SessionDto; index: number }) => (
      <Animated.View entering={FadeInUp.delay(100 + index * 70).duration(400)}>
        <Swipeable renderRightActions={() => renderRightActions(item.id)}>
          <Pressable
            style={styles.sessionRow}
            onPress={() => {
              if (typeof item.id !== "number" || !Number.isFinite(item.id) || item.id <= 0) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              router.push(`/session/${item.id}`);
            }}
          >
            <Text style={styles.sessionType}>
              {sessionTypeLabel(String(item.session_type || "beat_making"), t)}
            </Text>
            <Text style={styles.sessionMeta}>
              {t("dashboard.sessionMinutes", { n: Math.round((item.duration_seconds ?? 0) / 60) })}
            </Text>
          </Pressable>
        </Swipeable>
      </Animated.View>
    ),
    [renderRightActions, router, t],
  );

  const lastUpdatedLabel = lastUpdated
    ? t("dashboard.updatedAgo", {
        mins: Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 60000)),
      })
    : null;

  const preview = notesPreview(active?.notes);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TutorialOverlay />
      {milestoneToast ? (
        <Animated.View entering={FadeInUp.duration(320)} style={styles.milestoneToast}>
          <LinearGradient
            colors={["#ff6a3d", "#a259ff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.milestoneToastInner}
          >
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
        data={recentSessions}
        keyExtractor={(item) => `session-${item.id}`}
        removeClippedSubviews={false}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={8}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.topBar}>
              <Text style={styles.username}>
              {t("dashboard.heyUser", { name: user?.username ?? t("dashboard.defaultUserName") })}
            </Text>
              <Pressable
                style={styles.iconButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  router.push("/notifications");
                }}
                accessibilityLabel={t("dashboard.notificationsA11y")}
              >
                <Bell color={colors.textPrimary} size={20} />
                {notifUnread > 0 ? <View style={styles.notifBadge} /> : null}
              </Pressable>
            </View>

            {loading ? <SessionSkeleton /> : null}

            <StreakHeroSection
              overview={displayOverview}
              loading={loading}
              freezeBusy={freezeBusy}
              onUseFreeze={onUseFreeze}
              onOpenHistory={() => {
                Haptics.selectionAsync().catch(() => undefined);
                router.push("/streak/history");
              }}
            />

            <DashboardMotivationCard
              greeting={getTimeBasedGreeting()}
              userName={user?.username ?? t("dashboard.defaultUserName")}
              message={motivationMessage}
              serverMessage={serverMotivationLine}
              todaySessionCount={todayStats.count}
            />

            {active ? (
              <View style={styles.activeSessionBlock}>
                  <View style={styles.badgeRow}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {sessionTypeLabel(String(active.session_type || "beat_making"), t)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timerRingWrap}>
                    <Animated.View style={[styles.pulseRingOuter, ringAnimatedStyle]} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("dashboard.focusModeA11y")}
                      onPress={openFullscreenActive}
                      style={styles.timerPressable}
                    >
                      <LinearGradient colors={["#2a1410", "#1a1a1a"]} style={styles.timerInner}>
                        <Text style={styles.heroTimer}>{formatTimer(activeSeconds)}</Text>
                        <Text style={styles.elapsedNatural}>
                          {formatNaturalCounting(activeSeconds, t)}
                        </Text>
                        {preview ? (
                          <Text style={styles.notesPreview} numberOfLines={2}>
                            {preview}
                          </Text>
                        ) : null}
                        <View style={styles.swipeHint}>
                          <Text style={styles.swipeHintText}>{t("dashboard.swipeFocusHint")}</Text>
                        </View>
                      </LinearGradient>
                    </Pressable>
                  </View>

                  <Pressable
                    style={({ pressed }) => [styles.stopSessionBtn, pressed && styles.pressedStop]}
                    onPress={confirmStop}
                    disabled={stopBusy}
                  >
                    <Text style={styles.stopSessionLabel}>
                      {stopBusy ? t("dashboard.stopping") : t("dashboard.stopSession")}
                    </Text>
                  </Pressable>
                </View>
            ) : (
              <DashboardSessionStarter onQuickStart={openSetup} />
            )}

            <FriendsActivityWidget
              currentUserId={user?.id ?? 0}
              activity={friendActivity}
              leaderboard={friendLeaderboard?.entries ?? []}
              loading={socialLoading}
            />

            <TodayProgressCard
              todaySessions={todayStats.count}
              todayMinutes={todayStats.minutes}
              weekSessions={weekSessionsCount}
              weekGoalTarget={weeklyGoalTarget}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("dashboard.recentSessions")}</Text>
              <View style={styles.sectionHeaderRight}>
                <Pressable onPress={() => router.push("/(tabs)/stats")}>
                  <Text style={styles.viewAllLink}>{t("dashboard.statsLink")}</Text>
                </Pressable>
                <Text style={styles.headerSep}>·</Text>
                <Pressable onPress={() => router.push("/(tabs)/session-trash")}>
                  <Text style={styles.trashLink}>{t("dashboard.trashLink")}</Text>
                </Pressable>
              </View>
            </View>
            {lastUpdatedLabel ? <Text style={styles.updatedHint}>{lastUpdatedLabel}</Text> : null}
            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
                <PrimaryButton
                  label={t("dashboard.retry")}
                  onPress={() => {
                    setError(null);
                    setLoading(true);
                    Promise.all([loadSessions(), loadStreakOverview(), loadSocial()])
                      .catch((e) => setError(e instanceof Error ? e.message : t("dashboard.loadFailed")))
                      .finally(() => setLoading(false));
                  }}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading && visibleSessions.length === 0 && !active ? (
            <View style={styles.emptyCard}>
              <Flame
                color={colors.primary}
                size={48}
                style={{ alignSelf: "center", marginBottom: spacing.sm }}
              />
              <Text style={styles.emptyTitle}>{t("dashboard.emptyStreakTitle")}</Text>
              <PrimaryButton label={t("dashboard.startSession")} onPress={openSetup} />
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
        {/* Modals are a separate native hierarchy on iOS — gestures need their own root here. */}
        <GestureHandlerRootView style={styles.modalGestureRoot}>
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalBackdrop} onPress={() => closeSetupModal()} />
            <Animated.View style={[styles.modalSheet, sheetStyle]}>
              <SafeAreaView style={styles.modalSafe} edges={["bottom"]}>
                <View>
                  <View style={styles.modalHandle} />
                  <View style={styles.modalHeaderRow}>
                    <Text style={styles.modalTitle}>{t("dashboard.newSessionTitle")}</Text>
                    <Pressable
                      hitSlop={12}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                          () => undefined,
                        );
                        closeSetupModal();
                      }}
                      style={styles.modalCloseBtn}
                    >
                      <Text style={styles.modalCloseText}>✕</Text>
                    </Pressable>
                  </View>
                  <CrashBoundary
                    scope="session_setup_modal"
                    fallbackTitle={t("crashBoundary.sessionSetupTitle")}
                    fallbackMessage={t("crashBoundary.sessionSetupMessage")}
                    onRecover={() => {
                      closeSetupModal(() => {
                        router.push("/session/setup");
                      });
                    }}
                  >
                    <SessionSetupForm
                      key={setupModalKey}
                      hideTitleRow
                      onActiveSessionConflict={() => {
                        closeSetupModal(() => {
                          void loadSessions();
                          void loadStreakOverview();
                        });
                      }}
                      onStarted={(created) => {
                        const session = tryParseSessionDto(created);
                        if (!session) {
                          setError(t("dashboard.couldNotReadSession"));
                          closeSetupModal(() => {
                            void loadSessions();
                          });
                          return;
                        }
                        setActive(session);
                        setSessions((prev) => {
                          const rest = prev.filter((s) => s.id !== session.id);
                          return [session, ...rest];
                        });
                        setNowMs(Date.now());
                        closeSetupModal(() => {
                          void Promise.all([
                            loadSessions().catch(() => null),
                            loadStreakOverview().catch(() => null),
                          ]);
                        });
                      }}
                    />
                  </CrashBoundary>
                </View>
              </SafeAreaView>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
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
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.background,
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
  timerPressable: {
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
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    opacity: 0.9,
  },
  swipeHintText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontSize: 12,
    textAlign: "center",
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
  sectionHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  viewAllLink: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  headerSep: { color: colors.textSecondary, ...typography.caption },
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
  modalGestureRoot: {
    flex: 1,
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
