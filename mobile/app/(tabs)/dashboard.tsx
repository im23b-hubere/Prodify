import { useRouter } from "expo-router";
import { Bell, Flame, Trophy } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { DashboardSessionSetupModal } from "../../features/dashboard/components/DashboardSessionSetupModal";
import { useDashboardData } from "../../features/dashboard/hooks/useDashboardData";
import { useDashboardLifecycle } from "../../features/dashboard/hooks/useDashboardLifecycle";
import { useDashboardPresentation } from "../../features/dashboard/hooks/useDashboardPresentation";
import { useDashboardSessionActions } from "../../features/dashboard/hooks/useDashboardSessionActions";
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
import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useRankProgression } from "../../hooks/useRankProgression";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { tryParseSessionDto } from "../../lib/sessionDto";
import type { SessionDto } from "../../types/session";
import { styles } from "../../features/dashboard/dashboardScreen.styles";

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
  const [socialActionBusy, setSocialActionBusy] = useState<string | null>(null);
  const {
    visibleSessions,
    recentSessions,
    clientStreak,
    weekSessionsForGoal,
    effectiveWeeklyGoalTarget,
    todayStats,
    todayPlan,
    paceForecast,
    sessionFeedback,
    displayOverview,
    studioStatusLine,
    lastUpdatedLabel,
  } = useDashboardPresentation({
    sessions,
    streakOverview,
    loading,
    weeklyGoalTarget,
    hasWeeklyGoal,
    weekSessionsCount,
    accountCreatedAtIso: user?.created_at,
    lastUpdated,
    t,
  });
  const {
    stopBusy,
    freezeBusy,
    goalSaving,
    openFullscreenActive,
    refresh: onRefresh,
    openSessionSetup,
    openStats,
    saveWeeklyGoal,
    useFreeze: onUseFreeze,
    explainFreezeUnavailable: onFreezeUnavailable,
    confirmStop,
    dismissSession,
  } = useDashboardSessionActions({
    token,
    active,
    suggestedSessionType: todayPlan.suggestedSessionType,
    displayOverview,
    t,
    setActive,
    setError,
    setRefreshing,
    loadSessions,
    loadStreakOverview,
    refreshDashboard,
  });
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
  const {
    notificationUnreadCount: notifUnread,
    refreshUnreadCount,
    userScopedStreakKey,
    userScopedMilestoneKey,
  } = useDashboardLifecycle({
    token,
    userId: user?.id,
    refreshDashboard,
    presentSessionSetup: presentSessionSetupModalFresh,
  });
  const { milestoneToast, breakModalOpen, breakModalStreak, dismissBreakModal } =
    useDashboardStreakEvents({
      userId: user?.id,
      streakOverview,
      userScopedMilestoneKey,
      userScopedStreakKey,
      t,
      refreshUnread: refreshUnreadCount,
    });

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
