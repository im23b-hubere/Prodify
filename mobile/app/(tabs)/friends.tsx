import { type Href, useRouter } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, Text, View, type ListRenderItem } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { FriendsActivityFeedItem } from "../../features/friends/components/FriendsActivityFeedItem";
import { FriendsIncomingSection } from "../../features/friends/components/FriendsIncomingSection";
import { FriendsModals } from "../../features/friends/components/FriendsModals";
import { FriendsOverviewSection } from "../../features/friends/components/FriendsOverviewSection";
import { FriendsScreenHeader } from "../../features/friends/components/FriendsScreenHeader";
import { FriendsTogetherSection } from "../../features/friends/components/FriendsTogetherSection";
import { useFriendsDashboardData } from "../../features/friends/hooks/useFriendsDashboardData";
import { useFriendsScreenActions } from "../../features/friends/hooks/useFriendsScreenActions";
import { useFriendsScreenState } from "../../features/friends/hooks/useFriendsScreenState";
import { friendsScreenStyles as styles } from "../../features/friends/styles/friendsScreen.styles";
import { hasPremiumAccess } from "../../lib/billing";
import { prependNotification } from "../../lib/notificationInbox";
import { sendLocalSocialNotification } from "../../lib/socialNotifications";
import type { FriendActivityDto } from "../../types/friends";

export default function FriendsScreen() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const state = useFriendsScreenState();
  const {
    mode,
    setMode,
    refreshing,
    loading,
    activity,
    incoming,
    error,
    addOpen,
    setAddOpen,
    addName,
    setAddName,
    addBusy,
    actionBusy,
    buddy,
    commitment,
    reactionUsersOpen,
    setReactionUsersOpen,
    reactionUsers,
    toastMessage,
    entitlement,
    upsellMessage,
    challengeCreateOpen,
    setChallengeCreateOpen,
    challengeTitle,
    setChallengeTitle,
    setChallengeKind,
    challengeTarget,
    setChallengeTarget,
    challengeDuration,
    setChallengeDuration,
    selectedMembers,
    setSelectedMembers,
    challengeCreateBusy,
    busyActionKey,
    reactionUsersLoading,
    buddyPickerOpen,
    setBuddyPickerOpen,
    goalEditorOpen,
    setGoalEditorOpen,
    goalTargetInput,
    setGoalTargetInput,
    goalDaysInput,
    setGoalDaysInput,
    goalWitnesses,
    setGoalWitnesses,
    goalSaving,
    sectionTab,
    setSectionTab,
    feedMetricsBySession,
    reactionBusyBySession,
  } = state;

  const periodParam = mode === "week" ? "week" : "all";
  const { load, onRefresh } = useFriendsDashboardData({ token, periodParam, t, state });

  const openSession = useCallback(
    (sessionId: number, ownerName: string) => {
      router.push({
        pathname: "/session/[id]",
        params: { id: String(sessionId), ownerName },
      } as Href);
    },
    [router],
  );
  const openSessionSetup = useCallback(() => {
    router.push("/session/setup" as Href);
  }, [router]);

  const actions = useFriendsScreenActions({
    token,
    userId: user?.id,
    t,
    load,
    state,
    openSession,
    openSessionSetup,
  });

  const visibleActivity = useMemo(
    () => activity.filter((item) => item.user_id !== user?.id),
    [activity, user?.id],
  );

  useEffect(() => {
    for (const request of incoming) {
      prependNotification({
        id: `social-friend-request-${request.id}`,
        category: "social",
        priority: "normal",
        title: t("notificationsUi.friendRequestTitle"),
        body: t("notificationsUi.friendRequestBody", { username: request.username }),
        actionLabel: t("notificationsUi.openFriends"),
        actionRoute: "/(tabs)/friends",
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        dedupeWindowMs: 5 * 60 * 1000,
      })
        .then((inserted) => {
          if (!inserted) return;
          return sendLocalSocialNotification({
            title: t("notificationsUi.friendRequestTitle"),
            body: t("notificationsUi.friendRequestBody", { username: request.username }),
            path: "/(tabs)/friends",
            throttleKey: `friend-request-${request.id}`,
            throttleMs: 30_000,
          });
        })
        .catch(() => undefined);
    }
  }, [incoming, t]);

  useEffect(() => {
    if (!user?.id) return;
    for (const item of activity) {
      const commentsCount = item.comments_count ?? 0;
      if (item.user_id !== user.id || item.session_id <= 0 || commentsCount <= 0) continue;
      prependNotification({
        id: `social-comment-${item.session_id}-${commentsCount}`,
        category: "social",
        priority: "normal",
        title: t("notificationsUi.newCommentTitle"),
        body: t("notificationsUi.newCommentBody", { count: commentsCount }),
        actionLabel: t("notificationsUi.openSession"),
        actionRoute: `/session/${item.session_id}`,
        ttlMs: 5 * 24 * 60 * 60 * 1000,
        dedupeWindowMs: 2 * 60 * 1000,
      })
        .then((inserted) => {
          if (!inserted) return;
          return sendLocalSocialNotification({
            title: t("notificationsUi.newCommentTitle"),
            body: t("notificationsUi.newCommentBody", { count: commentsCount }),
            path: `/session/${item.session_id}`,
            throttleKey: `comment-session-${item.session_id}`,
            throttleMs: 60_000,
          });
        })
        .catch(() => undefined);
    }
  }, [activity, t, user?.id]);

  const renderActivityItem = useCallback<ListRenderItem<FriendActivityDto>>(
    ({ item, index }) => {
      const isSessionItem =
        item.session_id > 0 && (item.status === "live" || item.status === "completed");
      const metrics = feedMetricsBySession[item.session_id];
      const reactionTotal = metrics?.reactionsCount ?? item.reactions_count ?? 0;
      const commentCount = metrics?.commentsCount ?? item.comments_count ?? 0;
      const reactedByMe = metrics?.viewerReaction === "👍";
      return (
        <FriendsActivityFeedItem
          item={item}
          index={index}
          reactionTotal={reactionTotal}
          commentCount={commentCount}
          reactedByMe={reactedByMe}
          reactionBusy={!!reactionBusyBySession[item.session_id]}
          currentUserId={user?.id}
          t={t}
          onOpenSession={() => {
            if (isSessionItem) {
              openSession(item.session_id, item.username);
            }
          }}
          onToggleThumb={() => {
            if (isSessionItem) {
              void actions.toggleThumbReaction(item);
            }
          }}
          onOpenReactionUsers={() => {
            if (isSessionItem) {
              void actions.openReactionUsers(item.session_id);
            }
          }}
          onSupportStreakBreak={() => {
            if (item.status === "streak_broken" && item.user_id !== user?.id) {
              void actions.supportStreakBreak(item);
            }
          }}
          onViewCommitment={() => {
            if (item.status === "commitment_published") {
              setSectionTab("tools");
            }
          }}
          supportBusy={
            item.status === "streak_broken" &&
            item.user_id !== user?.id &&
            busyActionKey === "streak_support"
          }
        />
      );
    },
    [
      actions,
      busyActionKey,
      feedMetricsBySession,
      reactionBusyBySession,
      setSectionTab,
      t,
      openSession,
      user?.id,
    ],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={[0]}
        keyExtractor={(item) => String(item)}
        renderItem={() => null}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            <FriendsScreenHeader
              title={t("friendsScreen.title")}
              subtitle={t("friendsScreen.subtitle")}
              tabOverviewLabel={t("friendsScreen.tabOverview")}
              tabToolsLabel={t("friendsScreen.tabSocialTools")}
              sectionTab={sectionTab}
              onOpenAddFriend={() => setAddOpen(true)}
              onChangeTab={setSectionTab}
              addFriendA11y={t("friendsScreen.addFriendA11y")}
            />
            {!loading && !actions.hasOtherFriends ? (
              <View style={styles.emptyFriendsCard}>
                <View style={styles.emptyFriendsIcon}>
                  <UserPlus color={colors.primary} size={18} />
                </View>
                <View style={styles.emptyFriendsCopy}>
                  <Text style={styles.emptyFriendsTitle}>{t("friendsScreen.feedEmptyTitle")}</Text>
                  <Text style={styles.userMeta}>{t("friendsScreen.feedEmptyMessage")}</Text>
                </View>
                <PrimaryButton
                  label={t("friendsScreen.feedEmptyCta")}
                  onPress={() => setAddOpen(true)}
                />
              </View>
            ) : null}
            {!hasPremiumAccess(entitlement) && upsellMessage ? (
              <View style={styles.upsellCard}>
                <Text style={styles.upsellTitle}>{t("friendsScreen.premiumBoost")}</Text>
                <Text style={styles.userMeta}>{upsellMessage}</Text>
                <PrimaryButton
                  label={t("friendsScreen.unlockPremiumCta")}
                  onPress={() => router.push("/paywall")}
                />
              </View>
            ) : null}
            {error ? (
              <ErrorState
                title={t("common.oops")}
                message={error}
                retryLabel={t("common.tryAgain")}
                onRetry={() => load().catch(() => undefined)}
              />
            ) : null}
            {loading && !refreshing && !error ? (
              <LoadingState message={t("friendsScreen.loading")} />
            ) : null}

            {!(loading && !refreshing) && !error ? (
              <>
                <FriendsIncomingSection
                  t={t}
                  incoming={incoming}
                  actionBusy={actionBusy}
                  onAccept={actions.acceptRequest}
                  onDecline={actions.declineRequest}
                />
                {sectionTab === "overview" ? (
                  <FriendsOverviewSection
                    t={t}
                    mode={mode}
                    setMode={setMode}
                    loading={loading}
                    entries={actions.entries}
                    currentUserId={user?.id}
                    activity={visibleActivity}
                    renderActivityItem={renderActivityItem}
                    activeTriggerCard={actions.activeTriggerCard}
                    onCompleteTriggerAction={actions.completeTriggerAction}
                    onAddFriendFromEmptyFeed={() => setAddOpen(true)}
                  />
                ) : null}
                {sectionTab === "tools" ? (
                  <FriendsTogetherSection
                    t={t}
                    busyActionKey={busyActionKey}
                    onJoinSocialChallenge={actions.joinSocialChallengeById}
                    onOpenChallengeCreate={() => {
                      setChallengeKind("duel");
                      setChallengeTarget("5");
                      setChallengeDuration("7");
                      setChallengeTitle("");
                      setSelectedMembers([]);
                      setChallengeCreateOpen(true);
                    }}
                    onOpenSessionSetup={openSessionSetup}
                    buddy={buddy}
                    commitment={commitment}
                    hasOtherFriends={actions.hasOtherFriends}
                    onOpenBuddyPicker={() => setBuddyPickerOpen(true)}
                    onOpenAddFriend={() => setAddOpen(true)}
                    onAcceptBuddyInvite={actions.acceptBuddyInvite}
                    pendingBuddyInviteId={actions.pendingBuddyInviteId}
                    challengeCards={actions.challengeCards}
                    currentUserId={user?.id}
                  />
                ) : null}
              </>
            ) : null}
          </>
        }
      />

      {toastMessage ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      <FriendsModals
        t={t}
        reactionUsersOpen={reactionUsersOpen}
        setReactionUsersOpen={setReactionUsersOpen}
        reactionUsersLoading={reactionUsersLoading}
        reactionUsers={reactionUsers}
        buddyPickerOpen={buddyPickerOpen}
        setBuddyPickerOpen={setBuddyPickerOpen}
        friendCandidates={actions.friendCandidates}
        busyActionKey={busyActionKey}
        inviteBuddy={actions.inviteBuddy}
        goalEditorOpen={goalEditorOpen}
        setGoalEditorOpen={setGoalEditorOpen}
        goalTargetInput={goalTargetInput}
        setGoalTargetInput={setGoalTargetInput}
        goalDaysInput={goalDaysInput}
        setGoalDaysInput={setGoalDaysInput}
        goalWitnesses={goalWitnesses}
        setGoalWitnesses={setGoalWitnesses}
        goalSaving={goalSaving}
        saveCommitmentTarget={actions.saveCommitmentTarget}
        challengeCreateOpen={challengeCreateOpen}
        setChallengeCreateOpen={setChallengeCreateOpen}
        challengeTitle={challengeTitle}
        setChallengeTitle={setChallengeTitle}
        challengeTarget={challengeTarget}
        setChallengeTarget={setChallengeTarget}
        challengeDuration={challengeDuration}
        setChallengeDuration={setChallengeDuration}
        entries={actions.entries}
        currentUserId={user?.id}
        selectedMembers={selectedMembers}
        setSelectedMembers={setSelectedMembers}
        challengeCreateBusy={challengeCreateBusy}
        submitCreateChallenge={actions.submitCreateChallenge}
        resetChallengeModal={actions.resetChallengeModal}
        addOpen={addOpen}
        setAddOpen={setAddOpen}
        addName={addName}
        setAddName={setAddName}
        addBusy={addBusy}
        sendRequest={actions.sendRequest}
      />
    </SafeAreaView>
  );
}
