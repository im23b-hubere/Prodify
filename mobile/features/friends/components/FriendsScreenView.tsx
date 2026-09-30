import { UserPlus } from "lucide-react-native";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../../components/states/EmptyState";
import { ErrorState } from "../../../components/states/ErrorState";
import { colors } from "../../../constants/theme";
import { DuelBoardSkeleton } from "../../challenges/board/components/DuelBoardSkeleton";
import { ActivitySection } from "../activity/components/ActivitySection";
import { LiveNowStrip } from "../activity/components/LiveNowStrip";
import { friendsScreenStyles as styles } from "../styles/friendsScreen.styles";
import type { FriendsScreenController } from "../hooks/useFriendsScreenController";
import { FriendsStandingSection } from "../ranking/components/FriendsStandingSection";
import { FriendsInboxSection } from "./inbox/FriendsInboxSection";
import { FriendsModals } from "./FriendsModals";
import type { FriendsOverviewProps } from "./FriendsOverviewSection";
import { FriendsOverviewSkeleton } from "./FriendsOverviewSkeleton";
import { FriendsRefreshErrorBanner } from "./FriendsRefreshErrorBanner";
import { FriendsScreenHeader } from "./FriendsScreenHeader";
import { FriendsTogetherSection } from "./FriendsTogetherSection";

type Props = { controller: FriendsScreenController };

/** A leaderboard means at least one load succeeded, so there is data worth keeping on screen. */
function hasLoadedSnapshot(controller: FriendsScreenController) {
  return controller.state.leaderboard != null;
}

function FriendsStatusMessages({ controller }: Props) {
  const { t, state, actions, load } = controller;
  const retry = () => load({ force: true }).catch(() => undefined);
  return (
    <>
      {!state.loading &&
      !state.error &&
      !actions.hasOtherFriends &&
      state.sectionTab === "overview" ? (
        <EmptyState
          iconNode={<UserPlus color={colors.primary} size={36} />}
          title={t("friendsScreen.feedEmptyTitle")}
          message={t("friendsScreen.feedEmptyMessage")}
          actionLabel={t("friendsScreen.feedEmptyCta")}
          onAction={() => state.setAddOpen(true)}
        />
      ) : null}
      {state.error && hasLoadedSnapshot(controller) ? (
        <FriendsRefreshErrorBanner t={t} message={state.error} onRetry={retry} />
      ) : null}
      {state.error && !hasLoadedSnapshot(controller) ? (
        <ErrorState
          title={t("common.oops")}
          message={state.error}
          retryLabel={t("common.tryAgain")}
          onRetry={retry}
        />
      ) : null}
      {state.loading && !state.refreshing && !state.error ? (
        state.sectionTab === "challenges" ? (
          <DuelBoardSkeleton t={t} />
        ) : (
          <FriendsOverviewSkeleton t={t} />
        )
      ) : null}
    </>
  );
}

function FriendsLoadedSections({ controller }: Props) {
  const { t, userId, state, actions } = controller;
  const showOverview = state.sectionTab === "overview" && actions.hasOtherFriends;
  const sectionProps: FriendsOverviewProps = {
    t,
    mode: state.mode,
    setMode: state.setMode,
    entries: actions.entries,
    currentUserId: userId,
    onStartSession: controller.openSessionSetup,
    onOpenProfile: controller.openProfile,
  };
  return (
    <Animated.View entering={FadeIn.duration(240)}>
      <FriendsInboxSection
        t={t}
        incoming={state.incoming}
        challenges={state.challenges}
        requestBusyId={state.actionBusy}
        onAcceptRequest={actions.acceptRequest}
        onDeclineRequest={actions.declineRequest}
        duelActions={{
          t,
          currentUserId: userId,
          busyActionKey: state.busyActionKey,
          onAcceptChallengeInvite: actions.acceptChallengeInvite,
          onDeclineChallengeInvite: actions.declineChallengeInvite,
        }}
      />
      {showOverview ? (
        <View style={styles.overview}>
          <LiveNowStrip
            t={t}
            live={controller.liveActivity}
            onOpenProfile={controller.openProfile}
          />
          <FriendsStandingSection props={sectionProps} />
          <ActivitySection
            t={t}
            activity={controller.feedActivity}
            renderActivity={controller.renderActivity}
            onStartSession={controller.openSessionSetup}
          />
        </View>
      ) : null}
      {state.sectionTab === "challenges" ? (
        <FriendsTogetherSection
          t={t}
          busyActionKey={state.busyActionKey}
          onOpenChallengeCreate={controller.openChallengeCreate}
          onChallengeFriend={controller.challengeFriend}
          onRematchDuel={controller.rematchDuel}
          onOpenChallenge={controller.openChallenge}
          onWithdrawChallengeInvite={actions.withdrawChallengeInvite}
          onOpenSessionSetup={controller.openSessionSetup}
          buddy={state.buddy}
          hasOtherFriends={actions.hasOtherFriends}
          onOpenBuddyPicker={() => state.setBuddyPickerOpen(true)}
          onOpenAddFriend={() => state.setAddOpen(true)}
          onAcceptBuddyInvite={actions.acceptBuddyInvite}
          pendingBuddyInviteId={actions.pendingBuddyInviteId}
          friends={actions.entries}
          challengeCards={actions.challengeCards}
          duelRecords={state.duelRecords}
          currentUserId={userId}
        />
      ) : null}
    </Animated.View>
  );
}

function FriendsScreenOverlays({ controller }: Props) {
  const { state } = controller;
  return (
    <>
      {state.toastMessage ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.toast}>
          <Text style={styles.toastText}>{state.toastMessage}</Text>
        </Animated.View>
      ) : null}
      <FriendsModals controller={controller} />
    </>
  );
}

export function FriendsScreenView({ controller }: Props) {
  const { t, state, onRefresh } = controller;
  // Keep last known good Friends data visible when a refresh fails.
  // Hide content only while the initial load is in flight, or when there is
  // an error with no previously successful snapshot.
  const showLoadedSections =
    !(state.loading && !state.refreshing) && (hasLoadedSnapshot(controller) || !state.error);
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="friends-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <FriendsScreenHeader
          title={t("friendsScreen.title")}
          tabOverviewLabel={t("friendsScreen.tabOverview")}
          tabChallengesLabel={t("friendsScreen.tabChallenges")}
          sectionTab={state.sectionTab}
          onOpenAddFriend={() => state.setAddOpen(true)}
          onChangeTab={state.setSectionTab}
          addFriendA11y={t("friendsScreen.addFriendA11y")}
        />
        <FriendsStatusMessages controller={controller} />
        {showLoadedSections ? <FriendsLoadedSections controller={controller} /> : null}
      </ScrollView>
      <FriendsScreenOverlays controller={controller} />
    </SafeAreaView>
  );
}
