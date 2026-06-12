import * as Haptics from "expo-haptics";
import { type Href } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo } from "react";
import { Alert } from "react-native";

import { type ApiError, apiJson } from "../../../lib/client";
import { recordMomentumAction } from "../../../lib/momentum";
import {
  createChallenge,
  fetchSessionReactionUsers,
  joinSocialChallenge,
  toggleSessionReaction,
} from "../../../lib/social";
import type { FriendActivityDto } from "../../../types/friends";
import type { FriendsTriggerCard } from "../components/FriendsOverviewSection";
import type { FriendsScreenState } from "./useFriendsScreenState";

type Params = {
  token: string | null;
  userId?: number;
  t: TFunction;
  load: (opts?: { force?: boolean }) => Promise<void>;
  state: FriendsScreenState;
  openSession: (sessionId: number, ownerName: string) => void;
  openSessionSetup: () => void;
};

export function useFriendsScreenActions({
  token,
  userId,
  t,
  load,
  state,
  openSession,
  openSessionSetup,
}: Params) {
  const { setTriggerIndex } = state;
  const entries = state.leaderboard?.entries ?? [];
  const hasOtherFriends = entries.some((entry) => entry.user_id !== userId);
  const friendCandidates = entries.filter((entry) => entry.user_id !== userId);
  const challengeCards = useMemo(() => state.challenges.slice(0, 5), [state.challenges]);

  const sendRequest = useCallback(async () => {
    const username = state.addName.trim();
    if (username.length < 2) {
      Alert.alert(t("friendsScreen.alertUsername"), t("friendsScreen.alertUsernameInvalid"));
      return;
    }
    if (!token) return;
    state.setAddBusy(true);
    try {
      await apiJson("/friends/request", { token, method: "POST", body: { username } });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      state.setAddName("");
      state.setAddOpen(false);
      await load({ force: true });
      Alert.alert(
        t("friendsScreen.requestSentTitle"),
        t("friendsScreen.requestSentBody", { name: username }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("friendsScreen.couldNotSend");
      Alert.alert(t("friendsScreen.couldNotSend"), msg);
    } finally {
      state.setAddBusy(false);
    }
  }, [load, state, t, token]);

  const acceptRequest = useCallback(
    async (id: number) => {
      if (!token) return;
      state.setActionBusy(id);
      try {
        await apiJson(`/friends/${id}/accept`, { token, method: "POST" });
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const actions = await apiJson<{ key: string; title: string; cta_label: string }[]>(
          `/friends/${id}/post-accept-actions`,
          { token },
        ).catch(() => []);
        await load({ force: true });
        if (actions.length > 0) {
          Alert.alert(
            t("friendsScreen.requestAcceptedTitle"),
            t("friendsScreen.requestAcceptedBody", {
              actions: actions.map((a) => `• ${a.title}`).join("\n"),
            }),
          );
        }
      } catch (e) {
        Alert.alert(
          t("friendsScreen.errorGeneric"),
          e instanceof Error ? e.message : t("friendsScreen.acceptFailed"),
        );
      } finally {
        state.setActionBusy(null);
      }
    },
    [load, state, t, token],
  );

  const declineRequest = useCallback(
    async (id: number) => {
      if (!token) return;
      state.setActionBusy(id);
      try {
        await apiJson(`/friends/${id}`, { token, method: "DELETE" });
        await load({ force: true });
      } catch (e) {
        Alert.alert(
          t("friendsScreen.errorGeneric"),
          e instanceof Error ? e.message : t("friendsScreen.declineFailed"),
        );
      } finally {
        state.setActionBusy(null);
      }
    },
    [load, state, t, token],
  );

  const joinSocialChallengeById = useCallback(
    async (challengeId: number) => {
      if (!token) return;
      state.setBusyActionKey(`join_challenge_${challengeId}`);
      try {
        await joinSocialChallenge(token, challengeId);
        await load({ force: true });
        if (userId) {
          await recordMomentumAction(userId, "challenge");
        }
        state.showToast(t("friendsScreen.toastChallengeJoined"));
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("common.tryAgain");
        if ((e as ApiError).status === 402) {
          state.setUpsellMessage(msg);
        }
        Alert.alert(t("friendsScreen.errorGeneric"), msg);
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [load, state, t, token, userId],
  );

  const submitShipCheckin = useCallback(async () => {
    if (!token) return;
    state.setBusyActionKey("ship_checkin");
    try {
      await apiJson("/social/checkins/done", {
        token,
        method: "POST",
        body: {
          note: t("friendsScreen.shippedThisWeekNote", { defaultValue: "Shipped this week." }),
        },
      });
      await load({ force: true });
      state.showToast(t("friendsScreen.toastMomentum"));
    } catch (e) {
      Alert.alert(
        t("friendsScreen.errorGeneric"),
        e instanceof Error ? e.message : t("common.tryAgain"),
      );
    } finally {
      state.setBusyActionKey(null);
    }
  }, [load, state, t, token]);

  const inviteBuddy = useCallback(
    async (friendUserId: number) => {
      if (!token) return;
      if (!friendCandidates.some((entry) => entry.user_id === friendUserId)) {
        Alert.alert(t("friendsScreen.errorGeneric"), t("friendsScreen.feedEmptyMessage"));
        state.setAddOpen(true);
        return;
      }
      state.setBusyActionKey("buddy_invite");
      try {
        await apiJson("/social/buddy/invite", {
          token,
          method: "POST",
          body: { friend_user_id: friendUserId },
        });
        await load({ force: true });
        state.showToast(t("friendsScreen.toastSocialEngaged"));
        state.setBuddyPickerOpen(false);
      } catch (e) {
        Alert.alert(
          t("friendsScreen.errorGeneric"),
          e instanceof Error ? e.message : t("common.tryAgain"),
        );
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [friendCandidates, load, state, t, token],
  );

  const resetChallengeModal = useCallback(() => {
    state.setChallengeCreateOpen(false);
    state.setChallengeTitle("");
    state.setChallengeTarget("5");
    state.setChallengeDuration("7");
    state.setSelectedMembers([]);
  }, [state]);

  const submitCreateChallenge = useCallback(async () => {
    if (!token) return;
    const title = state.challengeTitle.trim();
    const target = Number.parseInt(state.challengeTarget, 10);
    const durationDays = Number.parseInt(state.challengeDuration, 10);
    const memberIds = state.selectedMembers.filter((id) => id !== userId);

    if (
      title.length < 3 ||
      !Number.isFinite(target) ||
      target < 1 ||
      !Number.isFinite(durationDays) ||
      durationDays < 3
    ) {
      Alert.alert(
        t("friendsScreen.invalidChallengeTitle"),
        t("friendsScreen.invalidChallengeBody"),
      );
      return;
    }

    if (memberIds.length === 0) {
      Alert.alert(
        t("friendsScreen.invalidChallengeTitle"),
        t("friendsScreen.challengePickFriendRequired"),
      );
      return;
    }

    state.setChallengeCreateBusy(true);
    try {
      await createChallenge(token, {
        challenge_kind: state.challengeKind,
        title,
        target_sessions: target,
        duration_days: durationDays,
        member_user_ids: memberIds,
      });
      resetChallengeModal();
      await load({ force: true });
      if (userId) {
        await recordMomentumAction(userId, "challenge");
      }
      state.showToast(t("friendsScreen.toastChallengeLive"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      if (msg.toLowerCase().includes("upgrade")) {
        state.setUpsellMessage(msg);
      }
      Alert.alert(t("friendsScreen.couldNotCreateChallenge"), msg);
    } finally {
      state.setChallengeCreateBusy(false);
    }
  }, [load, resetChallengeModal, state, t, token, userId]);

  const openReactionUsers = useCallback(
    async (sessionId: number) => {
      if (!token) return;
      state.setReactionUsersOpen(true);
      state.setReactionUsersLoading(true);
      try {
        const rows = await fetchSessionReactionUsers(token, sessionId);
        state.setReactionUsers(rows);
      } catch (e) {
        state.setReactionUsers([]);
        Alert.alert(
          t("friendsScreen.errorGeneric"),
          e instanceof Error ? e.message : t("common.tryAgain"),
        );
      } finally {
        state.setReactionUsersLoading(false);
      }
    },
    [state, t, token],
  );

  const toggleThumbReaction = useCallback(
    async (item: FriendActivityDto) => {
      if (!token || state.reactionBusyBySession[item.session_id]) return;
      const sessionId = item.session_id;
      const previous = state.feedMetricsBySession[sessionId] ?? {
        reactionsCount: item.reactions_count ?? 0,
        commentsCount: item.comments_count ?? 0,
        viewerReaction: item.viewer_reaction ?? null,
      };
      const hadThumb = previous.viewerReaction === "👍";
      const optimistic = {
        ...previous,
        viewerReaction: hadThumb ? null : "👍",
        reactionsCount: Math.max(0, previous.reactionsCount + (hadThumb ? -1 : 1)),
      };
      state.setFeedMetricsBySession((prev) => ({ ...prev, [sessionId]: optimistic }));
      state.setReactionBusyBySession((prev) => ({ ...prev, [sessionId]: true }));
      try {
        const updated = await toggleSessionReaction(token, sessionId, "👍");
        const updatedCount = updated.reduce((sum, row) => sum + row.count, 0);
        const mine = updated.find((row) => row.emoji === "👍" && row.reacted_by_me);
        state.setFeedMetricsBySession((prev) => ({
          ...prev,
          [sessionId]: {
            reactionsCount: updatedCount,
            commentsCount: prev[sessionId]?.commentsCount ?? previous.commentsCount,
            viewerReaction: mine ? "👍" : null,
          },
        }));
      } catch (e) {
        state.setFeedMetricsBySession((prev) => ({ ...prev, [sessionId]: previous }));
        Alert.alert(
          t("friendsScreen.errorGeneric"),
          e instanceof Error ? e.message : t("common.tryAgain"),
        );
      } finally {
        state.setReactionBusyBySession((prev) => ({ ...prev, [sessionId]: false }));
      }
    },
    [state, t, token],
  );

  const acceptBuddyInvite = useCallback(
    async (inviteId: number) => {
      if (!token) return;
      state.setBusyActionKey("buddy_accept");
      try {
        await apiJson("/social/buddy/accept", {
          token,
          method: "POST",
          body: { invite_id: inviteId },
        });
        await load({ force: true });
        state.showToast(t("friendsScreen.toastCollaborativeMove"));
      } catch (e) {
        Alert.alert(
          t("friendsScreen.errorGeneric"),
          e instanceof Error ? e.message : t("common.tryAgain"),
        );
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [load, state, t, token],
  );

  const supportStreakBreak = useCallback(
    async (item: FriendActivityDto) => {
      if (!token || !item.user_id || item.user_id <= 0) return;
      if (typeof userId === "number" && item.user_id === userId) {
        state.showToast(t("friendsScreen.supportSelfNotAllowed"));
        return;
      }
      state.setBusyActionKey("streak_support");
      try {
        const canRescue =
          state.buddy?.status === "active" && state.buddy.buddy_user_id === item.user_id;
        if (canRescue) {
          await apiJson("/social/streak/rescue", {
            token,
            method: "POST",
            body: { rescued_user_id: item.user_id },
          });
          state.showToast(t("friendsScreen.streakSupportRescueSuccess"));
        } else {
          await apiJson("/social/streak/encourage", {
            token,
            method: "POST",
            body: { rescued_user_id: item.user_id },
          });
          state.showToast(t("friendsScreen.streakSupportEncourageSuccess"));
        }
        await load({ force: true });
      } catch (e) {
        Alert.alert(
          t("friendsScreen.errorGeneric"),
          e instanceof Error ? e.message : t("common.tryAgain"),
        );
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [load, state, t, token, userId],
  );

  const triggerCards = useMemo<FriendsTriggerCard[]>(() => {
    const cards: FriendsTriggerCard[] = [];
    if (
      state.buddy?.status === "active" &&
      (state.buddy.buddy_week_sessions ?? 0) > (state.buddy.this_week_sessions ?? 0)
    ) {
      cards.push({
        key: "buddy_completed",
        title: t("friendsScreen.triggerBuddyStarted"),
        actionLabel: t("friendsScreen.triggerStartProducing"),
        onPress: () => {
          openSessionSetup();
          state.showToast(t("friendsScreen.toastLockedIn"));
        },
      });
    }
    const closeBattle = challengeCards.find((c) => {
      const mine = c.members.find((m) => m.user_id === userId);
      const lead =
        c.members.length > 0 ? Math.max(...c.members.map((m) => m.progress_sessions), 0) : 0;
      return mine && lead - mine.progress_sessions <= 1 && lead - mine.progress_sessions > 0;
    });
    const firstFriendOpenSession = state.activity.find(
      (a) =>
        a.session_id > 0 &&
        (a.status === "live" || a.status === "completed") &&
        (typeof userId !== "number" || a.user_id !== userId),
    );
    if (closeBattle) {
      cards.push({
        key: "close_battle",
        title: t("friendsScreen.triggerCloseBattle"),
        actionLabel: t("friendsScreen.triggerComment"),
        onPress: () => {
          if (userId) void recordMomentumAction(userId, "social");
          if (firstFriendOpenSession) {
            openSession(firstFriendOpenSession.session_id, firstFriendOpenSession.username);
          }
        },
      });
    }
    if (state.buddy?.status === "active" && state.buddy.buddy_user_id) {
      cards.push({
        key: "streak_risk",
        title: t("friendsScreen.triggerBuddyRisk"),
        actionLabel: t("friendsScreen.triggerKeepAlive"),
        onPress: () => {
          if (!token) return;
          apiJson("/social/streak/rescue", {
            token,
            method: "POST",
            body: { rescued_user_id: state.buddy?.buddy_user_id },
          })
            .then(async () => {
              if (userId) {
                await recordMomentumAction(userId, "rescue");
              }
              state.showToast(t("friendsScreen.toastCollaborativeMove"));
              return load({ force: true });
            })
            .catch((e: unknown) => {
              Alert.alert(
                t("friendsScreen.errorGeneric"),
                e instanceof Error ? e.message : t("common.tryAgain"),
              );
            });
        },
      });
    }
    return cards;
  }, [challengeCards, load, openSession, openSessionSetup, state, t, token, userId]);

  useEffect(() => {
    setTriggerIndex(0);
  }, [setTriggerIndex, triggerCards.length]);

  const activeTriggerCard = triggerCards[state.triggerIndex] ?? null;
  const pendingBuddyInviteId =
    state.buddy?.status === "pending_incoming" && typeof state.buddy.invite_id === "number"
      ? state.buddy.invite_id
      : null;

  const completeTriggerAction = useCallback(() => {
    setTriggerIndex((prev) => (prev + 1 < triggerCards.length ? prev + 1 : prev));
  }, [setTriggerIndex, triggerCards.length]);

  const openSessionHref = useCallback(
    (sessionId: number, ownerName: string): Href => ({
      pathname: "/session/[id]",
      params: { id: String(sessionId), ownerName },
    }),
    [],
  );

  return {
    entries,
    hasOtherFriends,
    friendCandidates,
    challengeCards,
    activeTriggerCard,
    pendingBuddyInviteId,
    completeTriggerAction,
    sendRequest,
    acceptRequest,
    declineRequest,
    joinSocialChallengeById,
    submitShipCheckin,
    inviteBuddy,
    submitCreateChallenge,
    resetChallengeModal,
    openReactionUsers,
    toggleThumbReaction,
    acceptBuddyInvite,
    supportStreakBreak,
    openSessionHref,
  };
}
