import type { TFunction } from "i18next";
import { useCallback, useMemo } from "react";
import { Alert } from "react-native";

import { recordMomentumAction } from "../../../lib/momentum";
import {
  acceptSocialChallenge,
  createChallenge,
  declineSocialChallenge,
  joinSocialChallenge,
} from "../../../lib/social";
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
  const challengeCards = useMemo(() => state.challenges.slice(0, 5), [state.challenges]);
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
        Alert.alert(t("friendsScreen.errorGeneric"), msg);
      } finally {
        state.setBusyActionKey(null);
      }
    },
    [load, state, t, token, userId],
  );

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
      const created = await createChallenge(token, {
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
      state.showToast(
        t(created.status === "pending" ? "friendsScreen.toastChallengeInvited" : "friendsScreen.toastChallengeLive"),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      Alert.alert(t("friendsScreen.couldNotCreateChallenge"), msg);
    } finally {
      state.setChallengeCreateBusy(false);
    }
  }, [load, resetChallengeModal, state, t, token, userId]);

  return {
    challengeCards,
    joinSocialChallengeById,
    acceptChallengeInvite,
    declineChallengeInvite,
    submitCreateChallenge,
    resetChallengeModal,
  };
}
