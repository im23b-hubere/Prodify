import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useRef } from "react";
import { Alert } from "react-native";

import { apiJson } from "../../../lib/client";
import type { FriendIncomingDto } from "../../../types/friends";
import { useBlockUser } from "../../safety/hooks/useBlockUser";
import { setIncomingFriendRequestCount } from "../sync/friendsInboxBadge";
import type { FriendsScreenState } from "./useFriendsScreenState";

type ActionContext = {
  token: string | null;
  userId?: number;
  t: TFunction;
  load: (opts?: { force?: boolean }) => Promise<void>;
  state: FriendsScreenState;
};

export function useFriendRelationshipActions({ token, t, load, state }: ActionContext) {
  const sendInFlight = useRef(false);
  const sendRequest = useCallback(async () => {
    const username = state.addName.trim();
    if (username.length < 2) {
      Alert.alert(t("friendsScreen.alertUsername"), t("friendsScreen.alertUsernameInvalid"));
      return;
    }
    if (!token || sendInFlight.current || state.addBusy) return;
    sendInFlight.current = true;
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
      sendInFlight.current = false;
      state.setAddBusy(false);
    }
  }, [load, state, t, token]);

  const answeringIds = useRef(new Set<number>());
  const { setRequestsInFlight, setIncoming } = state;
  const beginAnswer = useCallback(
    (id: number, action: "accept" | "decline") => {
      if (answeringIds.current.has(id)) return false;
      answeringIds.current.add(id);
      setRequestsInFlight((current) => ({ ...current, [id]: action }));
      return true;
    },
    [setRequestsInFlight],
  );
  const endAnswer = useCallback(
    (id: number) => {
      answeringIds.current.delete(id);
      setRequestsInFlight(({ [id]: _settled, ...rest }) => rest);
    },
    [setRequestsInFlight],
  );

  /** Drop one inbox row via functional update so concurrent answers cannot clobber each other. */
  const removeIncomingOptimistically = useCallback(
    (id: number) => {
      setIncoming((previous) => {
        const next = previous.filter((request) => request.id !== id);
        setIncomingFriendRequestCount(next.length);
        return next;
      });
    },
    [setIncoming],
  );

  const acceptRequest = useCallback(
    async (id: number) => {
      if (!token || !beginAnswer(id, "accept")) return;
      removeIncomingOptimistically(id);
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
        // Reload ground truth instead of restoring a stale snapshot (safe with concurrent answers).
        await load({ force: true }).catch(() => undefined);
        Alert.alert(
          t("friendsScreen.errorGeneric"),
          e instanceof Error ? e.message : t("friendsScreen.acceptFailed"),
        );
      } finally {
        endAnswer(id);
      }
    },
    [beginAnswer, endAnswer, load, removeIncomingOptimistically, t, token],
  );

  const declineRequest = useCallback(
    async (id: number) => {
      if (!token || !beginAnswer(id, "decline")) return;
      removeIncomingOptimistically(id);
      try {
        await apiJson(`/friends/${id}`, { token, method: "DELETE" });
        await load({ force: true });
      } catch (e) {
        await load({ force: true }).catch(() => undefined);
        Alert.alert(
          t("friendsScreen.errorGeneric"),
          e instanceof Error ? e.message : t("friendsScreen.declineFailed"),
        );
      } finally {
        endAnswer(id);
      }
    },
    [beginAnswer, endAnswer, load, removeIncomingOptimistically, t, token],
  );

  const requestBlock = useBlockUser(token, t);
  const declineAndBlock = useCallback(
    (request: Pick<FriendIncomingDto, "user_id" | "username">) => {
      // Blocking removes the pending request on the server as well.
      requestBlock({ userId: request.user_id, name: request.username }, () => void load({ force: true }));
    },
    [load, requestBlock],
  );

  return { sendRequest, acceptRequest, declineRequest, declineAndBlock };
}
