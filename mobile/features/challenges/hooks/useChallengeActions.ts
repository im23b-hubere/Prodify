import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { cancelChallenge, joinSocialChallenge, leaveChallenge } from "../../../lib/social";
import type { SocialChallengeDto } from "../../../types/friends";

type ChallengeAction = "join" | "leave" | "cancel";
type ExitAction = Exclude<ChallengeAction, "join">;
type SetChallenge = (challenge: SocialChallengeDto | null) => void;

export function useChallengeActions(
  token: string | null | undefined,
  challengeId: number | null,
  setChallenge: SetChallenge,
) {
  const { t } = useTranslation();
  const router = useRouter();
  const [busyActionKey, setBusyActionKey] = useState<ChallengeAction | null>(null);

  const runExitAction = useCallback(
    async (action: ExitAction) => {
      if (!token || challengeId == null) return;
      setBusyActionKey(action);
      try {
        if (action === "cancel") await cancelChallenge(token, challengeId);
        else await leaveChallenge(token, challengeId);
        router.back();
      } catch (actionError) {
        Alert.alert(
          t(actionErrorTitle(action)),
          actionError instanceof Error ? actionError.message : t("common.tryAgain"),
        );
      } finally {
        setBusyActionKey(null);
      }
    },
    [challengeId, router, t, token],
  );

  const confirmExit = useCallback(
    (action: ExitAction) => {
      if (!token || challengeId == null) return;
      const copy = exitConfirmationCopy(action);
      Alert.alert(t(copy.title), t(copy.body), [
        { text: t("friendsScreen.modalCancel"), style: "cancel" },
        {
          text: t(copy.confirm),
          style: "destructive",
          onPress: () => void runExitAction(action),
        },
      ]);
    },
    [challengeId, runExitAction, t, token],
  );

  const join = useCallback(async () => {
    if (!token || challengeId == null) return;
    setBusyActionKey("join");
    try {
      setChallenge(await joinSocialChallenge(token, challengeId));
    } catch (joinError) {
      Alert.alert(
        t("friendsScreen.errorGeneric"),
        joinError instanceof Error ? joinError.message : t("common.tryAgain"),
      );
    } finally {
      setBusyActionKey(null);
    }
  }, [challengeId, setChallenge, t, token]);

  const confirmCancel = useCallback(() => confirmExit("cancel"), [confirmExit]);
  const confirmLeave = useCallback(() => confirmExit("leave"), [confirmExit]);
  return { busyActionKey, join, confirmCancel, confirmLeave };
}

function actionErrorTitle(action: ExitAction) {
  return action === "cancel"
    ? "friendsScreen.couldNotEndChallenge"
    : "friendsScreen.couldNotLeaveChallenge";
}

function exitConfirmationCopy(action: ExitAction) {
  if (action === "cancel") {
    return {
      title: "friendsScreen.challengeEndTitle",
      body: "friendsScreen.challengeEndBody",
      confirm: "friendsScreen.challengeEndConfirm",
    };
  }
  return {
    title: "friendsScreen.challengeLeaveTitle",
    body: "friendsScreen.challengeLeaveBody",
    confirm: "friendsScreen.challengeLeaveConfirm",
  };
}
