import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo } from "react";
import { Alert } from "react-native";

import { apiJson } from "../../../lib/client";
import { recordMomentumAction } from "../../../lib/momentum";
import type { SocialChallengeDto } from "../../../types/friends";
import type { FriendsTriggerCard } from "../components/FriendsOverviewSection";
import type { FriendsScreenState } from "./useFriendsScreenState";

type ActionContext = {
  token: string | null;
  userId?: number;
  t: TFunction;
  load: (opts?: { force?: boolean }) => Promise<void>;
  state: FriendsScreenState;
};

type TriggerContext = ActionContext & {
  challengeCards: SocialChallengeDto[];
  openSession: (sessionId: number, ownerName: string) => void;
  openSessionSetup: () => void;
};

export function useFriendsTriggerCards({
  token,
  userId,
  t,
  load,
  state,
  challengeCards,
  openSession,
  openSessionSetup,
}: TriggerContext) {
  const { setTriggerIndex } = state;
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

  return { activeTriggerCard, pendingBuddyInviteId, completeTriggerAction };
}
