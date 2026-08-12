import type { TFunction } from "i18next";
import { useCallback } from "react";
import { Alert } from "react-native";

import { apiJson } from "../../../lib/client";
import { fetchSessionReactionUsers, toggleSessionReaction } from "../../../lib/social";
import type { FriendActivityDto } from "../../../types/friends";
import type { FriendsScreenState } from "./useFriendsScreenState";

type ActionContext = {
  token: string | null;
  userId?: number;
  t: TFunction;
  load: (opts?: { force?: boolean }) => Promise<void>;
  state: FriendsScreenState;
};

type EngagementContext = ActionContext & {
  friendCandidateIds: Set<number>;
};

export function useFriendEngagementActions({
  token,
  userId,
  t,
  load,
  state,
  friendCandidateIds,
}: EngagementContext) {
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
      if (!friendCandidateIds.has(friendUserId)) {
        Alert.alert(t("friendsScreen.errorGeneric"), t("friendsScreen.buddyPickerEmptyMessage"));
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
    [friendCandidateIds, load, state, t, token],
  );

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

  return {
    submitShipCheckin,
    inviteBuddy,
    openReactionUsers,
    toggleThumbReaction,
    acceptBuddyInvite,
    supportStreakBreak,
  };
}
