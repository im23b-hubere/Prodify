import { useFocusEffect } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { Bell, Flame } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInUp,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ActiveSessionBlock } from "../../features/dashboard/components/ActiveSessionBlock";
import { ReturnHookCard } from "../../features/dashboard/components/ReturnHookCard";
import { DashboardSessionSetupModal } from "../../features/dashboard/components/DashboardSessionSetupModal";
import { SessionSkeleton } from "../../features/dashboard/components/SessionSkeleton";
import { useDashboardData } from "../../features/dashboard/hooks/useDashboardData";
import { useDashboardSessionSetupModal } from "../../features/dashboard/hooks/useDashboardSessionSetupModal";
import { useDashboardSocialActions } from "../../features/dashboard/hooks/useDashboardSocialActions";
import { useDashboardSocialNudges } from "../../features/dashboard/hooks/useDashboardSocialNudges";
import { useDashboardStreakEvents } from "../../features/dashboard/hooks/useDashboardStreakEvents";

import { DashboardMotivationCard } from "../../components/dashboard/DashboardMotivationCard";
import { DashboardSessionStarter } from "../../components/dashboard/DashboardSessionStarter";
import { FriendsActivityWidget } from "../../components/dashboard/FriendsActivityWidget";
import { ProgressionBarCard } from "../../components/progression/ProgressionBarCard";
import { TodayProgressCard } from "../../components/dashboard/TodayProgressCard";
import { StreakBreakModal } from "../../components/streak/StreakBreakModal";
import { StreakHeroSection } from "../../components/streak/StreakHeroSection";
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
import { translateMotivationalMessage } from "../../lib/motivationApi";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { tryParseSessionDto } from "../../lib/sessionDto";
import {
  generateMotivationMessage,
  getTimeBasedGreeting,
  getTimeOfDay,
} from "../../lib/motivationEngine";
import { STREAK_MILESTONES } from "../../lib/streakMilestones";
import { getUnreadCount } from "../../lib/notificationInbox";
import { registerPushTokenWithBackend } from "../../lib/pushToken";
import { effectiveElapsedSeconds, formatDurationWords } from "../../lib/sessionTime";
import {
  completedSessionsCount,
  pickPaywallVariant,
  shouldTriggerPaywall,
} from "../../lib/paywallRules";
import {
  getLast7DaysProgress,
  getStreak,
  parseApiDate,
  toDateKey,
} from "../../features/dashboard/utils";
import type { SessionDto } from "../../types/session";
import type { StreakOverviewDto } from "../../types/streak";

const ActiveSessionTimerBlock = ({
  active,
  onOpenFullscreen,
  onConfirmStop,
  stopBusy,
}: {
  active: SessionDto;
  onOpenFullscreen: () => void;
  onConfirmStop: () => void;
  stopBusy: boolean;
}) => {
  const [nowMs, setNowMs] = useState(Date.now());
  const ringPulse = useSharedValue(1);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    ringPulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 1100 }), withTiming(1, { duration: 1100 })),
      -1,
      true,
    );
  }, [ringPulse]);

  const activeSeconds = useMemo(() => effectiveElapsedSeconds(active, nowMs), [active, nowMs]);

  return (
    <ActiveSessionBlock
      active={active}
      activeSeconds={activeSeconds}
      ringPulse={ringPulse}
      onOpenFullscreen={onOpenFullscreen}
      onConfirmStop={onConfirmStop}
      stopBusy={stopBusy}
    />
  );
};

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const {
    sessions,
    setSessions,
    active,
    setActive,
    loading,
    error,
    setError,
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
    weekSessionsCount,
    serverMotivationDto,
    forecast,
    progression,
    entitlement,
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
  const {
    momentumState,
    momentumScore,
    primaryNudge,
    secondaryNudge,
    returnHook,
    advancePrimaryNudge,
    applyMomentumAction,
  } = useDashboardSocialNudges({
    userId: user?.id,
    friendActivity,
    buddyRisk,
    socialChallenges,
    commitmentStatus,
    checkinStatus,
    streakOverviewCurrent: streakOverview?.current_streak,
    clientStreak,
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
    loadSessions,
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
      streakOverview,
      userScopedMilestoneKey,
      userScopedStreakKey,
      t,
      refreshUnread: refreshUnreadCount,
    });

  useFocusEffect(
    useCallback(() => {
      refreshDashboard({ force: false, withLoading: false }).catch(() => null);
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
    }, [refreshDashboard, presentSessionSetupModalFresh, refreshUnreadCount]),
  );

  useEffect(() => {
    if (!token) return;
    registerPushTokenWithBackend(token).catch(() => undefined);
  }, [token]);

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
  const completedCount = useMemo(() => completedSessionsCount(visibleSessions), [visibleSessions]);

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

            <ReturnHookCard
              summaryLine={returnHook}
              momentumState={momentumState}
              momentumScore={momentumScore}
            />

            {active ? (
              <ActiveSessionTimerBlock
                active={active}
                onOpenFullscreen={openFullscreenActive}
                onConfirmStop={confirmStop}
                stopBusy={stopBusy}
              />
            ) : (
              <DashboardSessionStarter onQuickStart={openSetup} />
            )}

            <FriendsActivityWidget
              currentUserId={user?.id ?? 0}
              activity={friendActivity}
              leaderboard={friendLeaderboard?.entries ?? []}
              loading={socialLoading}
              primaryAction={
                primaryNudge
                  ? {
                      message: identityState?.line
                        ? `${primaryNudge.message} ${identityState.line}`
                        : primaryNudge.message,
                      ctaLabel: primaryNudge.ctaLabel,
                      busy:
                        (primaryNudge.actionKey === "rescue" && socialActionBusy === "rescue") ||
                        (primaryNudge.actionKey === "checkin" && socialActionBusy === "checkin") ||
                        (primaryNudge.actionKey === "start_session" &&
                          socialActionBusy === "commitment"),
                      onPress: runPrimaryAction,
                    }
                  : null
              }
              secondaryHint={secondaryNudge ?? identityState?.line ?? null}
            />

            <TodayProgressCard
              todaySessions={todayStats.count}
              todayMinutes={todayStats.minutes}
              weekSessions={weekSessionsCount}
              weekGoalTarget={weeklyGoalTarget}
              goalForecast={forecast}
            />
            {entitlement?.entitlement !== "premium" ? (
              <View style={styles.premiumCtaCard}>
                <Text style={styles.premiumCtaTitle}>{t("dashboard.premiumUpsellTitle")}</Text>
                <Text style={styles.premiumCtaBody}>{t("dashboard.premiumUpsellBody")}</Text>
                <PrimaryButton
                  label={t("dashboard.premiumUpsellCta")}
                  onPress={() => router.push("/paywall")}
                />
              </View>
            ) : null}
            <ProgressionBarCard progression={progression} />

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
                    refreshDashboard({ force: true, withLoading: true }).catch(() => null);
                  }}
                />
              </View>
            ) : null}
            {entitlement?.entitlement !== "premium" &&
            shouldTriggerPaywall({
              completedSessionsCount: completedCount,
              sawFirstWeeklyReview: false,
              openedFirstInsight: false,
            }) ? (
              <PrimaryButton
                label={t("dashboard.unlockPremiumOutcomes")}
                onPress={() =>
                  router.push({
                    pathname: "/paywall",
                    params: {
                      variant: pickPaywallVariant({
                        completedSessionsCount: completedCount,
                        sawFirstWeeklyReview: false,
                        openedFirstInsight: false,
                      }),
                    },
                  })
                }
              />
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
  premiumCtaCard: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    backgroundColor: "rgba(251,191,36,0.08)",
    padding: spacing.md,
    gap: spacing.sm,
  },
  premiumCtaTitle: {
    color: "#fcd34d",
    fontFamily: fontFamily.heading,
    ...typography.body,
  },
  premiumCtaBody: {
    color: colors.textPrimary,
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
});
