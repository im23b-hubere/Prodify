import { UserPlus } from "lucide-react-native";
import { RefreshControl, ScrollView, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../../components/states/EmptyState";
import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import { colors } from "../../../constants/theme";
import { DuelBoardSkeleton } from "../../challenges/board/components/DuelBoardSkeleton";
import { friendsScreenStyles as styles } from "../styles/friendsScreen.styles";
import type { FriendsScreenController } from "../hooks/useFriendsScreenController";
import { FriendsActivitySection } from "./FriendsActivitySection";
import { FriendsDuelInvitesSection } from "./FriendsDuelInvitesSection";
import { FriendsIncomingSection } from "./FriendsIncomingSection";
import { FriendsLeaderboardSection } from "./FriendsLeaderboardSection";
import { FriendsModals } from "./FriendsModals";
import type { FriendsOverviewProps } from "./FriendsOverviewSection";
import { FriendsScreenHeader } from "./FriendsScreenHeader";
import { FriendsTogetherSection } from "./FriendsTogetherSection";

type Props = { controller: FriendsScreenController };

function FriendsStatusMessages({ controller }: Props) {
  const { t, state, actions, load } = controller;
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
      {state.error ? (
        <ErrorState
          title={t("common.oops")}
          message={state.error}
          retryLabel={t("common.tryAgain")}
          onRetry={() => load({ force: true }).catch(() => undefined)}
        />
      ) : null}
      {state.loading && !state.refreshing && !state.error ? (
        state.sectionTab === "challenges" ? (
          <DuelBoardSkeleton t={t} />
        ) : (
          <LoadingState message={t("friendsScreen.loading")} />
        )
      ) : null}
    </>
  );
}

function FriendsLoadedSections({ controller }: Props) {
  const { t, userId, state, actions, visibleActivity, renderActivity } = controller;
  const sectionProps: FriendsOverviewProps = {
    t,
    mode: state.mode,
    setMode: state.setMode,
    loading: state.loading,
    entries: actions.entries,
    currentUserId: userId,
    activity: visibleActivity,
    renderActivity,
    activeTriggerCard: actions.activeTriggerCard,
    onCompleteTriggerAction: actions.completeTriggerAction,
    onAddFriendFromEmptyFeed: () => state.setAddOpen(true),
  };
  return (
    <>
      <FriendsIncomingSection
        t={t}
        incoming={state.incoming}
        actionBusy={state.actionBusy}
        onAccept={actions.acceptRequest}
        onDecline={actions.declineRequest}
      />
      <FriendsDuelInvitesSection
        challenges={state.challenges}
        actions={{
          t,
          currentUserId: userId,
          busyActionKey: state.busyActionKey,
          onAcceptChallengeInvite: actions.acceptChallengeInvite,
          onDeclineChallengeInvite: actions.declineChallengeInvite,
        }}
      />
      {state.sectionTab === "overview" && actions.hasOtherFriends ? (
        <FriendsLeaderboardSection props={sectionProps} />
      ) : null}
      {state.sectionTab === "overview" && actions.hasOtherFriends ? (
        <FriendsActivitySection props={sectionProps} />
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
    </>
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
  const hasLoadedSnapshot = state.leaderboard != null;
  const showLoadedSections =
    !(state.loading && !state.refreshing) && (hasLoadedSnapshot || !state.error);
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
