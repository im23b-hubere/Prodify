import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DashboardRecentSessionRow } from "../../../components/dashboard/DashboardRecentSessionRow";
import { DashboardStudioHud } from "../../../components/dashboard/DashboardStudioHud";
import { FriendsActivityWidget } from "../../../components/dashboard/FriendsActivityWidget";
import { EmptyState } from "../../../components/states/EmptyState";
import { ErrorState } from "../../../components/states/ErrorState";
import { TutorialOverlay } from "../../../components/TutorialOverlay";
import { colors } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import type { SessionDto } from "../../../types/session";
import { styles } from "../dashboardScreen.styles";
import type { DashboardScreenController } from "../hooks/useDashboardScreenController";
import { DashboardFeedbackOverlays } from "./DashboardFeedbackOverlays";
import { DashboardScreenTopBar } from "./DashboardScreenTopBar";
import { DashboardSessionSetupModal } from "./DashboardSessionSetupModal";

function useChromeScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = event.nativeEvent.contentOffset.y > threshold;
      if (next === scrolledRef.current) return;
      scrolledRef.current = next;
      setScrolled(next);
    },
    [threshold],
  );
  return { scrolled, onScroll };
}

export function DashboardScreenView({ controller }: { controller: DashboardScreenController }) {
  const { data, experience, presentation, sessionActions, setup } = controller;
  const insets = useSafeAreaInsets();
  const { scrolled, onScroll } = useChromeScrolled();
  const renderItem = useRecentSessionRenderer(controller);
  return (
    <View style={styles.safe}>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,61,0,0.18)", "rgba(255,61,0,0.05)", "rgba(10,10,10,0)"]}
        locations={[0, 0.42, 1]}
        style={[styles.ambient, { height: insets.top + 188 }]}
      />
      <TutorialOverlay />
      <DashboardFeedbackOverlays
        milestoneToast={experience.milestoneToast}
        socialToast={controller.social.socialToast}
        breakModalOpen={experience.breakModalOpen}
        breakModalStreak={experience.breakModalStreak}
        dismissBreakModal={experience.dismissBreakModal}
        openSessionSetup={sessionActions.openSessionSetup}
      />
      <View
        testID="dashboard-chrome"
        style={[styles.chrome, { paddingTop: insets.top }, scrolled && styles.chromeScrolled]}
      >
        <DashboardScreenTopBar
          username={controller.user?.username}
          notificationUnreadCount={experience.notificationUnreadCount}
          onOpenNotifications={() => controller.router.push("/notifications")}
          t={controller.t}
        />
      </View>
      <FlatList
        data={presentation.recentSessions}
        keyExtractor={(item) => `session-${item.id}`}
        removeClippedSubviews={false}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={8}
        contentInsetAdjustmentBehavior="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={data.refreshing}
            onRefresh={sessionActions.refresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={<DashboardHeader controller={controller} />}
        ListEmptyComponent={
          !data.loading &&
          data.activeResolved &&
          presentation.visibleSessions.length === 0 &&
          !data.active ? (
            <EmptyState compact title={controller.t("dashboard.emptyStreakTitle")} />
          ) : null
        }
        contentContainerStyle={styles.listContainer}
        renderItem={renderItem}
      />
      <DashboardSessionSetupModal
        visible={setup.setupVisible}
        formKey={setup.setupModalKey}
        sheetStyle={setup.sheetStyle}
        closeSetupModal={setup.closeSetupModal}
        onCrashRecover={experience.recoverFromCrash}
        onActiveSessionConflict={experience.resolveActiveSessionConflict}
        onSessionStarted={experience.handleSessionStarted}
      />
    </View>
  );
}

function DashboardHeader({ controller }: { controller: DashboardScreenController }) {
  const { data, presentation, t } = controller;
  return (
    <View style={styles.headerContent}>
      {presentation.sparkLine ? (
        <Text style={styles.sparkLine} numberOfLines={2}>
          {presentation.sparkLine}
        </Text>
      ) : null}
      <StudioSection controller={controller} />
      <SocialSection controller={controller} />
      <SessionsHeader controller={controller} />
      {data.error ? (
        <ErrorState
          title={t("common.oops")}
          message={data.error}
          retryLabel={t("common.tryAgain")}
          onRetry={() => {
            data.setError(null);
            void data.refreshDashboard({ force: true, withLoading: true });
          }}
        />
      ) : null}
    </View>
  );
}

function StudioSection({ controller }: { controller: DashboardScreenController }) {
  const { data, level, presentation, sessionActions, t } = controller;
  return (
    <DashboardStudioHud
      t={t}
      activeResolved={data.activeResolved}
      active={data.active}
      stopBusy={sessionActions.stopBusy}
      onQuickStart={sessionActions.openSessionSetup}
      onOpenFullscreen={sessionActions.openFullscreenActive}
      onConfirmStop={sessionActions.confirmStop}
      hasWeeklyGoal={data.hasWeeklyGoal}
      weekSessionsCount={presentation.weekSessionsForGoal}
      weeklyGoalTarget={presentation.effectiveWeeklyGoalTarget}
      savedWeeklyGoalTarget={data.weeklyGoalTarget}
      goalSaving={sessionActions.goalSaving}
      onSaveWeeklyGoal={sessionActions.saveWeeklyGoal}
      feedback={presentation.sessionFeedback}
      paceForecast={presentation.paceForecast}
      streakOverview={presentation.displayOverview}
      streakCount={presentation.displayOverview?.current_streak ?? presentation.clientStreak}
      todaySessions={presentation.todayStats.count}
      todayMinutes={presentation.todayStats.minutes}
      level={level}
      freezeBusy={sessionActions.freezeBusy}
      onUseFreeze={sessionActions.useFreeze}
      onFreezeUnavailable={sessionActions.explainFreezeUnavailable}
      onOpenStreakHistory={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        controller.router.push("/streak/history");
      }}
    />
  );
}

function SocialSection({ controller }: { controller: DashboardScreenController }) {
  const { data, social, socialActionBusy, t, user } = controller;
  const nudge = social.primaryNudge;
  return (
    <>
      {data.socialError ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            data.setSocialError(null);
            void data.loadSocial();
          }}
          style={({ pressed }) => [styles.socialWarning, pressed && { opacity: 0.92 }]}
        >
          <Text style={styles.socialWarningText}>{data.socialError}</Text>
          <Text style={styles.socialWarningAction}>{t("common.tryAgain")}</Text>
        </Pressable>
      ) : null}
      <FriendsActivityWidget
        currentUserId={user?.id ?? 0}
        activity={data.friendActivity}
        leaderboard={data.friendLeaderboard?.entries ?? []}
        loading={data.socialLoading}
        collapsible
        defaultExpanded={Boolean(nudge)}
        primaryAction={
          nudge
            ? {
                message: nudge.message,
                ctaLabel: nudge.ctaLabel,
                busy:
                  (nudge.actionKey === "rescue" && socialActionBusy === "rescue") ||
                  (nudge.actionKey === "start_session" && socialActionBusy === "commitment"),
                onPress: social.runPrimaryAction,
              }
            : null
        }
        secondaryHint={nudge ? null : social.secondaryNudge}
      />
    </>
  );
}

function SessionsHeader({ controller }: { controller: DashboardScreenController }) {
  const { router, t } = controller;
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{t("dashboard.recentSessions")}</Text>
      <Pressable
        onPress={() => router.push("/session/history")}
        style={({ pressed }) => pressed && styles.linkPressed}
        accessibilityRole="button"
        accessibilityLabel={t("dashboard.allSessionsLink")}
      >
        <Text style={styles.viewAllLink}>{t("dashboard.allSessionsLink")}</Text>
      </Pressable>
    </View>
  );
}

function useRecentSessionRenderer(controller: DashboardScreenController) {
  const { router, sessionActions, t } = controller;
  const renderRightActions = useCallback(
    (sessionId: number) => (
      <Pressable
        style={styles.deleteAction}
        onPress={() => void sessionActions.dismissSession(sessionId)}
      >
        <Text style={styles.deleteActionText}>{t("dashboard.deleteSwipe")}</Text>
      </Pressable>
    ),
    [sessionActions, t],
  );
  return useCallback(
    ({ item, index }: { item: SessionDto; index: number }) => {
      const typeLabel = sessionTypeLabel(String(item.session_type || "beat_making"), t);
      return (
        <Animated.View entering={FadeInUp.delay(100 + index * 70).duration(400)}>
          <Swipeable renderRightActions={() => renderRightActions(item.id)}>
            <DashboardRecentSessionRow
              session={item}
              typeLabel={typeLabel}
              accessibilityLabel={`${typeLabel}, ${t("dashboard.sessionMinutes", { n: Math.round((item.duration_seconds ?? 0) / 60) })}`}
              accessibilityHint={t("dashboard.openSessionDetailsA11y")}
              onPress={() => {
                if (typeof item.id === "number" && Number.isFinite(item.id) && item.id > 0)
                  router.push(`/session/${item.id}`);
              }}
            />
          </Swipeable>
        </Animated.View>
      );
    },
    [renderRightActions, router, t],
  );
}
