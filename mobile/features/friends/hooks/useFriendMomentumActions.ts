import { useCallback } from "react";
import { Alert } from "react-native";

import { apiJson } from "../../../lib/client";
import type { FriendActivityDto } from "../../../types/friends";
import type { FriendActionContext } from "./friendEngagementTypes";

export function useFriendMomentumActions(context: FriendActionContext) {
  return {
    submitShipCheckin: useShipCheckin(context),
    supportStreakBreak: useStreakSupport(context),
  };
}

function useShipCheckin({ load, state, t, token }: FriendActionContext) {
  return useCallback(async () => {
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
    } catch (error) {
      showMomentumError(t, error);
    } finally {
      state.setBusyActionKey(null);
    }
  }, [load, state, t, token]);
}

function useStreakSupport({ load, state, t, token, userId }: FriendActionContext) {
  return useCallback(
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
        await apiJson(canRescue ? "/social/streak/rescue" : "/social/streak/encourage", {
          token,
          method: "POST",
          body: { rescued_user_id: item.user_id },
        });
        state.showToast(
          t(
            canRescue
              ? "friendsScreen.streakSupportRescueSuccess"
              : "friendsScreen.streakSupportEncourageSuccess",
          ),
        );
        await load({ force: true });
      } catch (error) {
        showMomentumError(t, error);
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [load, state, t, token, userId],
  );
}

function showMomentumError(t: FriendActionContext["t"], error: unknown) {
  Alert.alert(
    t("friendsScreen.errorGeneric"),
    error instanceof Error ? error.message : t("common.tryAgain"),
  );
}
