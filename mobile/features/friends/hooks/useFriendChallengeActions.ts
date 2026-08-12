import type { TFunction } from "i18next";
import { useCallback, useMemo } from "react";
import { Alert } from "react-native";

import { recordMomentumAction } from "../../../lib/momentum";
import { createChallenge, joinSocialChallenge } from "../../../lib/social";
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
      await createChallenge(token, {
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
      state.showToast(t("friendsScreen.toastChallengeLive"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      Alert.alert(t("friendsScreen.couldNotCreateChallenge"), msg);
    } finally {
      state.setChallengeCreateBusy(false);
    }
  }, [load, resetChallengeModal, state, t, token, userId]);

  return { challengeCards, joinSocialChallengeById, submitCreateChallenge, resetChallengeModal };
}
