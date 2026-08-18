import { useCallback } from "react";
import { Alert } from "react-native";

import { apiJson } from "../../../lib/client";
import type { FriendEngagementContext } from "./friendEngagementTypes";

export function useFriendBuddyActions(context: FriendEngagementContext) {
  const { friendCandidateIds, load, state, t, token } = context;
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
      } catch (error) {
        showActionError(t, error);
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [friendCandidateIds, load, state, t, token],
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
      } catch (error) {
        showActionError(t, error);
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [load, state, t, token],
  );

  return { inviteBuddy, acceptBuddyInvite };
}

function showActionError(t: FriendEngagementContext["t"], error: unknown) {
  Alert.alert(
    t("friendsScreen.errorGeneric"),
    error instanceof Error ? error.message : t("common.tryAgain"),
  );
}
