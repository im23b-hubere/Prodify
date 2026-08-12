import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback } from "react";
import { Alert } from "react-native";

import { apiJson } from "../../../lib/client";
import type { FriendsScreenState } from "./useFriendsScreenState";

type ActionContext = {
  token: string | null;
  userId?: number;
  t: TFunction;
  load: (opts?: { force?: boolean }) => Promise<void>;
  state: FriendsScreenState;
};

export function useFriendRelationshipActions({ token, t, load, state }: ActionContext) {
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

  return { sendRequest, acceptRequest, declineRequest };
}
