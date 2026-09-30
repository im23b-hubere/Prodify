import type { TFunction } from "i18next";
import { useCallback } from "react";
import { Alert } from "react-native";

import { recordMomentumAction } from "../../../lib/momentum";
import {
  acceptSocialChallenge,
  cancelChallenge,
  declineSocialChallenge,
} from "../../../lib/social";
import type { SocialChallengeDto } from "../../../types/friends";
import { duelClashPayload } from "../../duelClash/duelClashPayload";
import { markDuelClashSeen } from "../../duelClash/duelClashSeen";
import { showDuelClash } from "../../duelClash/duelClashStore";
import type { FriendsScreenState } from "./useFriendsScreenState";

type ActionContext = {
  token: string | null;
  userId?: number;
  t: TFunction;
  load: (opts?: { force?: boolean }) => Promise<void>;
  state: FriendsScreenState;
};

export function useFriendChallengeActions({ token, userId, t, load, state }: ActionContext) {
  const challengeCards = state.challenges;

  const acceptChallengeInvite = useCallback(
    async (challengeId: number) => {
      if (!token || !userId) return;
      state.setBusyActionKey(`accept_challenge_${challengeId}`);
      try {
        const challenge = await acceptSocialChallenge(token, challengeId);
        await markDuelClashSeen(userId, challengeId);
        const payload = duelClashPayload(challenge, userId, t("friendsScreen.buddyDuelYouLabel"));
        if (payload) showDuelClash(payload);
        await load({ force: true });
        await recordMomentumAction(userId, "challenge");
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("common.tryAgain");
        Alert.alert(t("friendsScreen.errorGeneric"), msg);
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [load, state, t, token, userId],
  );

  const declineChallengeInvite = useCallback(
    async (challengeId: number) => {
      if (!token) return;
      state.setBusyActionKey(`decline_challenge_${challengeId}`);
      try {
        await declineSocialChallenge(token, challengeId);
        await load({ force: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("common.tryAgain");
        Alert.alert(t("friendsScreen.errorGeneric"), msg);
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [load, state, t, token],
  );

  const runWithdraw = useCallback(
    async (challengeId: number) => {
      if (!token) return;
      state.setBusyActionKey(`withdraw_challenge_${challengeId}`);
      try {
        await cancelChallenge(token, challengeId);
        await load({ force: true });
        state.showToast(t("duelBoard.withdrawnToast"));
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("common.tryAgain");
        Alert.alert(t("friendsScreen.errorGeneric"), msg);
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [load, state, t, token],
  );

  const withdrawChallengeInvite = useCallback(
    (challenge: SocialChallengeDto) => {
      const name = challenge.invitee_username ?? t("friendsScreen.challengeSomeone");
      Alert.alert(t("duelBoard.withdrawTitle"), t("duelBoard.withdrawBody", { name }), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("duelBoard.withdrawConfirm"),
          style: "destructive",
          onPress: () => void runWithdraw(challenge.id),
        },
      ]);
    },
    [runWithdraw, t],
  );

  return {
    challengeCards,
    acceptChallengeInvite,
    declineChallengeInvite,
    withdrawChallengeInvite,
  };
}
