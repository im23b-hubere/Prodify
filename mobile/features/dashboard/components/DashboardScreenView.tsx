import * as Haptics from "expo-haptics";
import { Flame } from "lucide-react-native";
import { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { DashboardRecentSessionRow } from "../../../components/dashboard/DashboardRecentSessionRow";
import { DashboardStudioHud } from "../../../components/dashboard/DashboardStudioHud";
import { FriendsActivityWidget } from "../../../components/dashboard/FriendsActivityWidget";
import { EmptyState } from "../../../components/states/EmptyState";
import { ErrorState } from "../../../components/states/ErrorState";
import { TutorialOverlay } from "../../../components/TutorialOverlay";
import { colors } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import type { SessionDto } from "../../../types/session";
import { WeeklyRecapTeaser } from "../../weeklyRecap/WeeklyRecapTeaser";
import { styles } from "../dashboardScreen.styles";
import type { DashboardScreenController } from "../hooks/useDashboardScreenController";
import { DashboardFeedbackOverlays } from "./DashboardFeedbackOverlays";
import { DashboardScreenTopBar } from "./DashboardScreenTopBar";
import { DashboardSessionSetupModal } from "./DashboardSessionSetupModal";

export function DashboardScreenView({ controller }: { controller: DashboardScreenController }) {
  const { data, experience, presentation, sessionActions, setup } = controller;
  const renderItem = useRecentSessionRenderer(controller);
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TutorialOverlay />
      <DashboardFeedbackOverlays
        milestoneToast={experience.milestoneToast}
        socialToast={controller.social.socialToast}
        breakModalOpen={experience.breakModalOpen}
        breakModalStreak={experience.breakModalStreak}
        dismissBreakModal={experience.dismissBreakModal}
        openSessionSetup={sessionActions.openSessionSetup}
      />
      <FlatList
        data={presentation.recentSessions}
        keyExtractor={(item) => `session-${item.id}`}
        removeClippedSubviews={false}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={8}
        refreshControl={
          <RefreshControl
            refreshing={data.refreshing}
            onRefresh={sessionActions.refresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={<DashboardHeader controller={controller} />}
        ListEmptyComponent={
          !data.loading && presentation.visibleSessions.length === 0 && !data.active ? (
            <EmptyState
              iconNode={<Flame color={colors.primary} size={48} />}
              title={controller.t("dashboard.emptyStreakTitle")}
              actionLabel={controller.t("dashboard.startSession")}
              onAction={sessionActions.openSessionSetup}
            />
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
    </SafeAreaView>
  );
}

function DashboardHeader({ controller }: { controller: DashboardScreenController }) {
  const { data, experience, presentation, t, user } = controller;
  return (
    <View style={styles.headerContent}>
      <DashboardScreenTopBar
        username={user?.username}
        notificationUnreadCount={experience.notificationUnreadCount}
        onOpenNotifications={() => controller.router.push("/notifications")}
        t={t}
      />
      <StudioSection controller={controller} />
      <WeeklyRecapTeaser t={t} onPress={() => controller.router.push("/weekly-recap")} />
      <SocialSection controller={controller} />
      <SessionsHeader controller={controller} />
      {presentation.lastUpdatedLabel ? (
        <Text style={styles.updatedHint}>{presentation.lastUpdatedLabel}</Text>
      ) : null}
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
      loading={data.loading && !presentation.displayOverview}
      active={data.active}
      stopBusy={sessionActions.stopBusy}
      onQuickStart={sessionActions.openSessionSetup}
      onOpenFullscreen={sessionActions.openFullscreenActive}
      onConfirmStop={sessionActions.confirmStop}
      hasWeeklyGoal={data.hasWeeklyGoal}
      weekSessionsCount={presentation.weekSessionsForGoal}
      weeklyGoalTarget={presentation.effectiveWeeklyGoalTarget}
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
                message: data.identityState?.line
                  ? `${nudge.message} ${data.identityState.line}`
                  : nudge.message,
                ctaLabel: nudge.ctaLabel,
                busy:
                  (nudge.actionKey === "rescue" && socialActionBusy === "rescue") ||
                  (nudge.actionKey === "start_session" && socialActionBusy === "commitment"),
                onPress: social.runPrimaryAction,
              }
            : null
        }
        secondaryHint={social.secondaryNudge ?? data.identityState?.line ?? null}
      />
    </>
  );
}

function SessionsHeader({ controller }: { controller: DashboardScreenController }) {
  const { router, sessionActions, t } = controller;
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{t("dashboard.recentSessions")}</Text>
      <View style={styles.sectionHeaderRight}>
        <HeaderLink
          label={t("dashboard.allSessionsLink")}
          onPress={() => router.push("/session/history")}
        />
        <HeaderLink
          label={t("dashboard.trashLink")}
          onPress={() => router.push("/(tabs)/session-trash")}
          trash
        />
        <HeaderLink label={t("dashboard.statsLink")} onPress={sessionActions.openStats} />
      </View>
    </View>
  );
}

function HeaderLink({
  label,
  onPress,
  trash = false,
}: {
  label: string;
  onPress: () => void;
  trash?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.linkPressed}>
      <Text style={trash ? styles.trashLink : styles.viewAllLink}>{label}</Text>
    </Pressable>
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
