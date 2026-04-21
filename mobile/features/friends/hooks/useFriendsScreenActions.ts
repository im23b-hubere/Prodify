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
  toggleSessionReaction,
} from "../../../lib/social";
import type { FriendActivityDto } from "../../../types/friends";
import type { FriendsTriggerCard } from "../components/FriendsOverviewSection";
import type { FriendsScreenState } from "./useFriendsScreenState";

type Params = {
  token: string | null;
  userId?: number;
  t: TFunction;
  load: () => Promise<void>;
  state: FriendsScreenState;
  openSession: (sessionId: number, ownerName: string) => void;
};

export function useFriendsScreenActions({ token, userId, t, load, state, openSession }: Params) {
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
      await load();
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
        await load();
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
        await load();
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

  const joinChallenge = useCallback(async () => {
    if (!token) return;
    if (!state.challengeId) {
      Alert.alert(t("friendsScreen.errorGeneric"), t("friendsScreen.noChallengesYet"));
      state.setChallengeCreateOpen(true);
      return;
    }
    state.setBusyActionKey("join_challenge");
    try {
      await apiJson("/social/challenges/join", {
        token,
        method: "POST",
        body: { challenge_id: state.challengeId },
      });
      await load();
      if (userId) {
        await recordMomentumAction(userId, "challenge");
      }
      state.showToast(t("friendsScreen.toastPressure"));
      state.setUpsellMessage(t("friendsScreen.upsellInviteFriend"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      if ((e as ApiError).status === 402) {
        state.setUpsellMessage(msg);
      }
      Alert.alert(t("friendsScreen.errorGeneric"), msg);
    } finally {
      state.setBusyActionKey(null);
    }
  }, [load, state, t, token, userId]);

  const submitShipCheckin = useCallback(async () => {
    if (!token) return;
    state.setBusyActionKey("ship_checkin");
    try {
      await apiJson("/social/checkins/done", {
        token,
        method: "POST",
        body: { note: "Shipped this week." },
      });
      await load();
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
        await load();
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

  const openGoalEditor = useCallback(() => {
    state.setGoalTargetInput(String(Math.max(1, state.commitment?.target_sessions ?? 5)));
    state.setGoalDaysInput(String(Math.max(3, state.commitment?.period_days ?? 7)));
    state.setGoalWitnesses((state.commitment?.witness_user_ids ?? []).slice(0, 3));
    state.setGoalEditorOpen(true);
  }, [state]);

  const saveCommitmentTarget = useCallback(async () => {
    if (!token) return;
    const target = Number.parseInt(state.goalTargetInput, 10);
    const periodDays = Number.parseInt(state.goalDaysInput, 10);
    if (!Number.isFinite(target) || target < 1 || target > 50) {
      Alert.alert(t("friendsScreen.couldNotSetGoal"), t("friendsScreen.invalidChallengeBody"));
      return;
    }
    if (!Number.isFinite(periodDays) || periodDays < 3 || periodDays > 30) {
      Alert.alert(t("friendsScreen.couldNotSetGoal"), t("friendsScreen.invalidChallengeBody"));
      return;
    }
    state.setGoalSaving(true);
    try {
      await apiJson("/social/commitment", {
        token,
        method: "POST",
        body: {
          target_sessions: target,
          visibility: "friends",
          commitment_key: "sessions",
          period_days: periodDays,
          witness_user_ids: state.goalWitnesses.slice(0, 3),
        },
      });
      await load();
      state.setGoalEditorOpen(false);
      state.showToast(t("friendsScreen.toastExtraGoal"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      if (msg.toLowerCase().includes("premium")) {
        state.setUpsellMessage(msg);
      }
      Alert.alert(t("friendsScreen.couldNotSetGoal"), msg);
    } finally {
      state.setGoalSaving(false);
    }
  }, [load, state, t, token]);

  const submitCreateChallenge = useCallback(async () => {
    if (!token) return;
    const title = state.challengeTitle.trim();
    const target = Number.parseInt(state.challengeTarget, 10);
    const durationDays = Number.parseInt(state.challengeDuration, 10);
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
    state.setChallengeCreateBusy(true);
    try {
      const memberIds = state.selectedMembers.filter((id) => id !== userId);
      await createChallenge(token, {
        challenge_kind: state.challengeKind,
        title,
        target_sessions: target,
        duration_days: durationDays,
        member_user_ids: memberIds,
      });
      state.setChallengeCreateOpen(false);
      state.setChallengeTitle("");
      state.setChallengeTarget("5");
      state.setChallengeDuration("7");
      state.setSelectedMembers([]);
      await load();
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
  }, [load, state, t, token, userId]);

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
        await load();
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
        await load();
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
          if (!token) return;
          apiJson("/sessions/quick-start", {
            token,
            method: "POST",
            body: { session_type: "beat_making" },
          })
            .then(async () => {
              if (userId) {
                await recordMomentumAction(userId, "session");
              }
              state.showToast(t("friendsScreen.toastLockedIn"));
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
    const closeBattle = challengeCards.find((c) => {
      const mine = c.members.find((m) => m.user_id === userId);
      const lead = Math.max(...c.members.map((m) => m.progress_sessions), 0);
      return mine && lead - mine.progress_sessions <= 1 && lead - mine.progress_sessions > 0;
    });
    if (closeBattle) {
      cards.push({
        key: "close_battle",
        title: t("friendsScreen.triggerCloseBattle"),
        actionLabel: t("friendsScreen.triggerComment"),
        onPress: () => {
          if (userId) void recordMomentumAction(userId, "social");
          if (state.activity[0]) {
            openSession(state.activity[0].session_id, state.activity[0].username);
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
              return load();
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
  }, [challengeCards, load, openSession, state, t, token, userId]);

  useEffect(() => {
    state.setTriggerIndex(0);
  }, [state.setTriggerIndex, triggerCards.length]);

  const activeTriggerCard = triggerCards[state.triggerIndex] ?? null;
  const pendingBuddyInviteId =
    state.buddy?.status === "pending_incoming" && typeof state.buddy.invite_id === "number"
      ? state.buddy.invite_id
      : null;

  const completeTriggerAction = useCallback(() => {
    state.setTriggerIndex((prev) => (prev + 1 < triggerCards.length ? prev + 1 : prev));
  }, [state, triggerCards.length]);

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
    joinChallenge,
    submitShipCheckin,
    inviteBuddy,
    openGoalEditor,
    saveCommitmentTarget,
    submitCreateChallenge,
    openReactionUsers,
    toggleThumbReaction,
    acceptBuddyInvite,
    supportStreakBreak,
    openSessionHref,
  };
}
