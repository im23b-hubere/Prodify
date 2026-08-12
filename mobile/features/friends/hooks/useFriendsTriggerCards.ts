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

function closeBattle(challenges: SocialChallengeDto[], userId?: number) {
  return challenges.find((challenge) => {
    const mine = challenge.members.find((member) => member.user_id === userId);
    const lead = Math.max(...challenge.members.map((member) => member.progress_sessions), 0);
    return mine && lead - mine.progress_sessions <= 1 && lead - mine.progress_sessions > 0;
  });
}

function firstOpenFriendSession(state: FriendsScreenState, userId?: number) {
  return state.activity.find(
    (activity) =>
      activity.session_id > 0 &&
      (activity.status === "live" || activity.status === "completed") &&
      (typeof userId !== "number" || activity.user_id !== userId),
  );
}

async function rescueBuddy(context: TriggerContext, buddyUserId: number) {
  const { token, userId, t, load, state } = context;
  if (!token) return;
  try {
    await apiJson("/social/streak/rescue", {
      token,
      method: "POST",
      body: { rescued_user_id: buddyUserId },
    });
    if (userId) await recordMomentumAction(userId, "rescue");
    state.showToast(t("friendsScreen.toastCollaborativeMove"));
    await load({ force: true });
  } catch (caught) {
    Alert.alert(
      t("friendsScreen.errorGeneric"),
      caught instanceof Error ? caught.message : t("common.tryAgain"),
    );
  }
}

export function buildFriendsTriggerCards(context: TriggerContext): FriendsTriggerCard[] {
  const { userId, t, state, challengeCards, openSession, openSessionSetup } = context;
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
  const battle = closeBattle(challengeCards, userId);
  const friendSession = firstOpenFriendSession(state, userId);
  if (battle) {
    cards.push({
      key: "close_battle",
      title: t("friendsScreen.triggerCloseBattle"),
      actionLabel: t("friendsScreen.triggerComment"),
      onPress: () => {
        if (userId) void recordMomentumAction(userId, "social");
        if (friendSession) openSession(friendSession.session_id, friendSession.username);
      },
    });
  }
  if (state.buddy?.status === "active" && state.buddy.buddy_user_id) {
    cards.push({
      key: "streak_risk",
      title: t("friendsScreen.triggerBuddyRisk"),
      actionLabel: t("friendsScreen.triggerKeepAlive"),
      onPress: () => void rescueBuddy(context, state.buddy?.buddy_user_id as number),
    });
  }
  return cards;
}

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
  const triggerCards = useMemo(
    () =>
      buildFriendsTriggerCards({
        token,
        userId,
        t,
        load,
        state,
        challengeCards,
        openSession,
        openSessionSetup,
      }),
    [challengeCards, load, openSession, openSessionSetup, state, t, token, userId],
  );

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
