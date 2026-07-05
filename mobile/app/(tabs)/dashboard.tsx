import { useFocusEffect } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { Bell, Flame, Trophy } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { DashboardSessionSetupModal } from "../../features/dashboard/components/DashboardSessionSetupModal";
import { useDashboardData } from "../../features/dashboard/hooks/useDashboardData";
import { useDashboardSessionSetupModal } from "../../features/dashboard/hooks/useDashboardSessionSetupModal";
import { useDashboardSocialActions } from "../../features/dashboard/hooks/useDashboardSocialActions";
import { useDashboardSocialNudges } from "../../features/dashboard/hooks/useDashboardSocialNudges";
import { useDashboardStreakEvents } from "../../features/dashboard/hooks/useDashboardStreakEvents";

import { DashboardStudioHud } from "../../components/dashboard/DashboardStudioHud";
import { DashboardRecentSessionRow } from "../../components/dashboard/DashboardRecentSessionRow";
import { FriendsActivityWidget } from "../../components/dashboard/FriendsActivityWidget";
import { WeeklyRecapTeaser } from "../../features/weeklyRecap/WeeklyRecapTeaser";
import { glyphRowStyle } from "../../components/icons/ProdifyGlyphs";
import { StreakBreakModal } from "../../components/streak/StreakBreakModal";
import { EmptyState } from "../../components/states/EmptyState";
import { ErrorState } from "../../components/states/ErrorState";
import { RankHudChip } from "../../components/progression/RankHudChip";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { TutorialOverlay } from "../../components/TutorialOverlay";
import { PENDING_SESSION_SETUP_KEY } from "../../constants/sessionUi";
import {
  LAST_KNOWN_STREAK_KEY,
  MILESTONE_CELEBRATED_MAX_KEY,
  userScopedLastKnownStreakKey,
  userScopedMilestoneCelebratedKey,
} from "../../constants/storageKeys";
import { fontFamily } from "../../constants/fonts";
import { colors, motion, radii, shadows, spacing, typography, ui } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useRankProgression } from "../../hooks/useRankProgression";
import { apiJson } from "../../lib/client";
import { debugLog } from "../../lib/debugLog";
import { buildWeeklyForecast } from "../../lib/forecastEngine";
import { setWeeklyGoal } from "../../lib/goals";
import { buildSessionFeedback } from "../../lib/sessionFeedbackEngine";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { tryParseSessionDto } from "../../lib/sessionDto";
import { buildTodayPlanRecommendation } from "../../lib/todayPlanEngine";
import { adjustedWeeklyTargetForSignupWeek } from "../../lib/goalPace";
import { STREAK_MILESTONES } from "../../lib/streakMilestones";
import { getUnreadCount, syncServerInbox } from "../../lib/notificationInbox";
import { registerPushTokenWithBackend } from "../../lib/pushToken";
import { effectiveElapsedSeconds, formatDurationWords } from "../../lib/sessionTime";
import {
  getLast7DaysProgress,
  getStreak,
  parseApiDate,
  toDateKey,
} from "../../features/dashboard/utils";
import type { SessionDto } from "../../types/session";
import type { StreakOverviewDto } from "../../types/streak";

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { level } = useRankProgression(Boolean(token));
  const router = useRouter();
  const {
    sessions,
    setSessions,
    active,
    setActive,
    loading,
    error,
    setError,
    socialError,
    setSocialError,
    refreshing,
    setRefreshing,
    lastUpdated,
    streakOverview,
    friendActivity,
    friendLeaderboard,
    socialLoading,
    buddyRisk,
    checkinStatus,
    commitmentStatus,
    socialChallenges,
    identityState,
    weeklyGoalTarget,
    hasWeeklyGoal,
    weekSessionsCount,
    loadSessions,
    loadStreakOverview,
    loadSocial,
    refreshDashboard,
  } = useDashboardData(token);
  const {
    setupVisible,
    setupModalKey,
    sheetStyle,
    closeSetupModal,
    presentSessionSetupModalFresh,
  } = useDashboardSessionSetupModal();
  const [stopBusy, setStopBusy] = useState(false);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [socialActionBusy, setSocialActionBusy] = useState<string | null>(null);
  const userScopedStreakKey = user?.id
    ? userScopedLastKnownStreakKey(user.id)
    : LAST_KNOWN_STREAK_KEY;
  const userScopedMilestoneKey = user?.id
    ? userScopedMilestoneCelebratedKey(user.id)
    : MILESTONE_CELEBRATED_MAX_KEY;

  const stopSessionInFlight = useRef(false);

  const weekProgress = useMemo(() => getLast7DaysProgress(sessions), [sessions]);
  const clientStreak = useMemo(() => getStreak(sessions), [sessions]);
  const visibleSessions = useMemo(
    () => sessions.filter((session) => session.stopped_at !== null),
    [sessions],
  );
  const { primaryNudge, secondaryNudge, advancePrimaryNudge, applyMomentumAction } =
    useDashboardSocialNudges({
      userId: user?.id,
      friendActivity,
      buddyRisk,
      socialChallenges,
      commitmentStatus,
      checkinStatus,
      t,
    });
  const { socialToast, runPrimaryAction } = useDashboardSocialActions({
    token,
    userId: user?.id,
    buddyRisk,
    primaryNudge,
    identityState,
    router,
    t,
    loadSocial,
    advancePrimaryNudge,
    applyMomentumAction,
    setSocialActionBusy,
  });
  const refreshUnreadCount = useCallback(() => {
    getUnreadCount()
      .then(setNotifUnread)
      .catch(() => undefined);
  }, []);
  const { milestoneToast, breakModalOpen, breakModalStreak, dismissBreakModal } =
    useDashboardStreakEvents({
      userId: user?.id,
      streakOverview,
      userScopedMilestoneKey,
      userScopedStreakKey,
      t,
      refreshUnread: refreshUnreadCount,
    });

  useFocusEffect(
    useCallback(() => {
      if (token) {
        syncServerInbox(token, 30)
          .then(() => refreshUnreadCount())
          .catch(() => undefined);
      }
      refreshDashboard({ withLoading: false }).catch(() => null);
      refreshUnreadCount();
      (async () => {
        try {
          const v = await SecureStore.getItemAsync(PENDING_SESSION_SETUP_KEY);
          if (v === "1") {
            await SecureStore.deleteItemAsync(PENDING_SESSION_SETUP_KEY);
            presentSessionSetupModalFresh();
          }
        } catch {
          /* ignore */
        }
      })();
    }, [refreshDashboard, presentSessionSetupModalFresh, refreshUnreadCount, token]),
  );

  useEffect(() => {
    if (!token) return;
    registerPushTokenWithBackend(token).catch(() => undefined);
  }, [token]);

  const openFullscreenActive = useCallback(() => {
    if (!active || typeof active.id !== "number" || !Number.isFinite(active.id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    router.push({
      pathname: "/session-active",
      params: { id: String(active.id), source: "dashboard" },
    });
  }, [active, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await refreshDashboard({ force: true, withLoading: false }).catch(() => undefined);
    setRefreshing(false);
  }, [refreshDashboard, setRefreshing]);

  const weekDayLetters = useMemo(() => {
    const letters = t("dashboard.weekdayShort", { returnObjects: true }) as string[];
    const safe =
      Array.isArray(letters) && letters.length === 7
        ? letters
        : ["M", "T", "W", "T", "F", "S", "S"];
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
  const weekSessionsForGoal = useMemo(() => {
    const safeCount = Number.isFinite(weekSessionsCount) ? weekSessionsCount : 0;
    return Math.max(0, safeCount);
  }, [weekSessionsCount]);
  const effectiveWeeklyGoalTarget = useMemo(
    () =>
      adjustedWeeklyTargetForSignupWeek({
        weeklyGoalTarget,
        accountCreatedAtIso: user?.created_at ?? null,
      }),
    [weeklyGoalTarget, user?.created_at],
  );

  const todayPlan = useMemo(
    () =>
      buildTodayPlanRecommendation({
        weeklyGoalTarget: effectiveWeeklyGoalTarget,
        weekSessionsCount: weekSessionsForGoal,
        currentStreak: streakOverview?.current_streak ?? clientStreak,
        streakAtRisk: streakOverview?.streak_at_risk ?? false,
        lastSessionAt: visibleSessions[0]?.started_at ?? null,
        lastSessionType:
          typeof visibleSessions[0]?.session_type === "string"
            ? visibleSessions[0].session_type
            : null,
      }),
    [effectiveWeeklyGoalTarget, weekSessionsForGoal, streakOverview, clientStreak, visibleSessions],
  );
  const paceForecast = useMemo(
    () =>
      effectiveWeeklyGoalTarget != null && effectiveWeeklyGoalTarget > 0
        ? buildWeeklyForecast({
            weeklyGoalTarget: effectiveWeeklyGoalTarget,
            completedThisWeek: weekSessionsForGoal,
          })
        : null,
    [effectiveWeeklyGoalTarget, weekSessionsForGoal],
  );
  const sessionFeedback = useMemo(
    () =>
      buildSessionFeedback({
        weeklyGoalTarget: effectiveWeeklyGoalTarget,
        weekSessionsCount: weekSessionsForGoal,
        currentStreak: streakOverview?.current_streak ?? clientStreak,
        sessionDurationSeconds: 0,
      }),
    [effectiveWeeklyGoalTarget, weekSessionsForGoal, streakOverview, clientStreak],
  );
  const studioStatusLine = useMemo(() => {
    if (!hasWeeklyGoal) return null;
    if (streakOverview?.streak_at_risk) return t("streakHero.riskBanner");
    if (paceForecast) return t(paceForecast.todayActionKey, paceForecast.todayActionParams);
    return null;
  }, [hasWeeklyGoal, streakOverview?.streak_at_risk, paceForecast, t]);

  const openSessionSetup = useCallback(() => {
    if (active) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    router.push({
      pathname: "/session/setup",
      params: {
        suggestedType: todayPlan.suggestedSessionType,
        source: "dashboard",
      },
    });
  }, [active, router, todayPlan.suggestedSessionType]);

  const recentSessions = useMemo(() => visibleSessions.slice(0, 3), [visibleSessions]);

  const openStats = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    router.push({
      pathname: "/(tabs)/stats",
      params: { focus: "yourWeek" },
    });
  }, [router]);

  const saveWeeklyGoal = useCallback(
    async (target: number) => {
      if (!token) return;
      setGoalSaving(true);
      try {
        await setWeeklyGoal(token, target);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        await refreshDashboard({ force: true });
      } catch (e) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        setError(e instanceof Error ? e.message : t("dashboard.weeklyGoalSaveFailed"));
      } finally {
        setGoalSaving(false);
      }
    },
    [token, refreshDashboard, setError, t],
  );

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

  const onFreezeUnavailable = useCallback(() => {
    const overview = displayOverview;
    if (!overview) return;
    if (overview.freezes_remaining < 1) {
      Alert.alert(t("dashboard.freezeUnavailableTitle"), t("dashboard.freezeReasonNoneLeft"));
      return;
    }
    if (!overview.streak_at_risk) {
      Alert.alert(t("dashboard.freezeUnavailableTitle"), t("dashboard.freezeReasonNotAtRisk"));
      return;
    }
    Alert.alert(t("dashboard.freezeUnavailableTitle"), t("dashboard.freezeReasonAlreadySafeToday"));
  }, [displayOverview, t]);

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
      ],
    );
  }, [active, token, router, loadSessions, t, setError, setActive]);

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
    [loadSessions, token, t, setError],
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
          <DashboardRecentSessionRow
            session={item}
            typeLabel={sessionTypeLabel(String(item.session_type || "beat_making"), t)}
            accessibilityLabel={`${sessionTypeLabel(String(item.session_type || "beat_making"), t)}, ${t("dashboard.sessionMinutes", { n: Math.round((item.duration_seconds ?? 0) / 60) })}`}
            accessibilityHint={t("dashboard.openSessionDetailsA11y")}
            onPress={() => {
              if (typeof item.id !== "number" || !Number.isFinite(item.id) || item.id <= 0) return;
              router.push(`/session/${item.id}`);
            }}
          />
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
            <View style={[glyphRowStyle, styles.milestoneToastRow]}>
              <Trophy size={18} color="#fff" strokeWidth={2.2} fill="#fff" />
              <Text style={styles.milestoneToastText}>{milestoneToast}</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      ) : null}
      {socialToast ? (
        <Animated.View entering={FadeInUp.duration(220)} style={styles.socialToast}>
          <Text style={styles.socialToastText}>{socialToast}</Text>
        </Animated.View>
      ) : null}
      <StreakBreakModal
        visible={breakModalOpen}
        brokenStreak={breakModalStreak}
        onStartFresh={() => {
          dismissBreakModal();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          openSessionSetup();
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
              <ScreenHeader
                titleNode={
                  <View style={styles.greetingRow}>
                    <Text style={styles.greetingPrefix}>{t("dashboard.heyPrefix")}</Text>
                    <Text
                      style={styles.greetingName}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >
                      {user?.username ?? t("dashboard.defaultUserName")}
                    </Text>
                  </View>
                }
                actionNode={
                  <View style={styles.headerActions}>
                    <RankHudChip from="dashboard" />
                    <Pressable
                      style={({ pressed }) => [
                        styles.iconButton,
                        pressed && styles.iconButtonPressed,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                          () => undefined,
                        );
                        router.push("/notifications");
                      }}
                      accessibilityLabel={t("dashboard.notificationsA11y")}
                    >
                      <Bell color={colors.textPrimary} size={20} />
                      {notifUnread > 0 ? <View style={styles.notifBadge} /> : null}
                    </Pressable>
                  </View>
                }
              />
            </View>

            <DashboardStudioHud
              t={t}
              loading={loading && !displayOverview}
              active={active}
              stopBusy={stopBusy}
              onQuickStart={openSessionSetup}
              onOpenFullscreen={openFullscreenActive}
              onConfirmStop={confirmStop}
              hasWeeklyGoal={hasWeeklyGoal}
              weekSessionsCount={weekSessionsForGoal}
              weeklyGoalTarget={effectiveWeeklyGoalTarget}
              goalSaving={goalSaving}
              onSaveWeeklyGoal={saveWeeklyGoal}
              feedback={sessionFeedback}
              paceForecast={paceForecast}
              streakOverview={displayOverview}
              streakCount={displayOverview?.current_streak ?? clientStreak}
              todaySessions={todayStats.count}
              todayMinutes={todayStats.minutes}
              level={level}
              statusLine={studioStatusLine}
              freezeBusy={freezeBusy}
              onUseFreeze={onUseFreeze}
              onFreezeUnavailable={onFreezeUnavailable}
              onOpenStreakHistory={() => {
                Haptics.selectionAsync().catch(() => undefined);
                router.push("/streak/history");
              }}
            />

            <WeeklyRecapTeaser t={t} onPress={() => router.push("/weekly-recap")} />

            {socialError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSocialError(null);
                  void loadSocial();
                }}
                style={({ pressed }) => [styles.socialWarning, pressed && { opacity: 0.92 }]}
              >
                <Text style={styles.socialWarningText}>{socialError}</Text>
                <Text style={styles.socialWarningAction}>{t("common.tryAgain")}</Text>
              </Pressable>
            ) : null}

            <FriendsActivityWidget
              currentUserId={user?.id ?? 0}
              activity={friendActivity}
              leaderboard={friendLeaderboard?.entries ?? []}
              loading={socialLoading}
              collapsible
              defaultExpanded={Boolean(primaryNudge)}
              primaryAction={
                primaryNudge
                  ? {
                      message: identityState?.line
                        ? `${primaryNudge.message} ${identityState.line}`
                        : primaryNudge.message,
                      ctaLabel: primaryNudge.ctaLabel,
                      busy:
                        (primaryNudge.actionKey === "rescue" && socialActionBusy === "rescue") ||
                        (primaryNudge.actionKey === "start_session" &&
                          socialActionBusy === "commitment"),
                      onPress: runPrimaryAction,
                    }
                  : null
              }
              secondaryHint={secondaryNudge ?? identityState?.line ?? null}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("dashboard.recentSessions")}</Text>
              <View style={styles.sectionHeaderRight}>
                <Pressable
                  onPress={() => router.push("/session/history")}
                  style={({ pressed }) => pressed && styles.linkPressed}
                >
                  <Text style={styles.viewAllLink}>{t("dashboard.allSessionsLink")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/(tabs)/session-trash")}
                  style={({ pressed }) => pressed && styles.linkPressed}
                >
                  <Text style={styles.trashLink}>{t("dashboard.trashLink")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => openStats()}
                  style={({ pressed }) => pressed && styles.linkPressed}
                >
                  <Text style={styles.viewAllLink}>{t("dashboard.statsLink")}</Text>
                </Pressable>
              </View>
            </View>
            {lastUpdatedLabel ? <Text style={styles.updatedHint}>{lastUpdatedLabel}</Text> : null}
            {error ? (
              <ErrorState
                title={t("common.oops")}
                message={error}
                retryLabel={t("common.tryAgain")}
                onRetry={() => {
                  setError(null);
                  refreshDashboard({ force: true, withLoading: true }).catch(() => null);
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading && visibleSessions.length === 0 && !active ? (
            <EmptyState
              iconNode={<Flame color={colors.primary} size={48} />}
              title={t("dashboard.emptyStreakTitle")}
              actionLabel={t("dashboard.startSession")}
              onAction={openSessionSetup}
            />
          ) : null
        }
        contentContainerStyle={styles.listContainer}
        renderItem={renderItem}
      />

      <DashboardSessionSetupModal
        visible={setupVisible}
        formKey={setupModalKey}
        sheetStyle={sheetStyle}
        closeSetupModal={closeSetupModal}
        onCrashRecover={() => {
          closeSetupModal(() => {
            router.push("/session/setup");
          });
        }}
        onActiveSessionConflict={() => {
          closeSetupModal(() => {
            void loadSessions();
            void loadStreakOverview();
          });
        }}
        onSessionStarted={(created) => {
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
          closeSetupModal(() => {
            void Promise.all([
              loadSessions().catch(() => null),
              loadStreakOverview().catch(() => null),
            ]);
          });
        }}
      />
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
  socialToast: {
    position: "absolute",
    top: 62,
    left: spacing.md,
    right: spacing.md,
    zIndex: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(14,14,14,0.96)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  socialToastText: {
    color: colors.textPrimary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
    textAlign: "center",
  },
  socialWarning: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,170,0,0.35)",
    backgroundColor: "rgba(255,170,0,0.08)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  socialWarningText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    lineHeight: 18,
  },
  socialWarningAction: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  milestoneToastInner: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  milestoneToastRow: {
    justifyContent: "center",
  },
  milestoneToastText: {
    color: "#ffffff",
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    textAlign: "center",
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: ui.screenPadding,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  headerContent: {
    paddingTop: spacing.xs,
    gap: spacing.md,
  },
  topBar: {
    marginBottom: spacing.xs,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 0,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "nowrap",
    flexShrink: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  greetingPrefix: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.screenTitle,
    flexShrink: 0,
  },
  greetingName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.screenTitle,
    flex: 1,
    minWidth: 0,
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
  iconButtonPressed: {
    opacity: motion.pressOpacity,
    transform: [{ scale: motion.pressScaleStrong }],
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
    ...typography.sectionTitle,
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
    ...typography.meta,
  },
  linkPressed: {
    opacity: motion.pressOpacityLight,
  },
  updatedHint: {
    color: colors.textSecondary,
    ...typography.meta,
    marginBottom: spacing.sm,
  },
  trashLink: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
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
    borderRadius: ui.cardRadius,
    borderWidth: ui.cardBorderWidth,
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
    ...typography.meta,
  },
});
