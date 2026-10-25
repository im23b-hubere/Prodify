import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { userFacingErrorMessage } from "../../../lib/userFacingErrorMessage";

type UseProfileAccountActionsOptions = {
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** Where to go once the account is signed out or deleted; login unless the caller says otherwise. */
  afterSessionEnds?: () => void;
};

export function useProfileAccountActions({
  signOut,
  deleteAccount,
  afterSessionEnds,
}: UseProfileAccountActionsOptions) {
  const { t } = useTranslation();
  const { replace } = useRouter();
  const leave = useCallback(
    () => (afterSessionEnds ? afterSessionEnds() : replace("/(auth)/login")),
    [afterSessionEnds, replace],
  );

  const confirmSignOut = useCallback(() => {
    Alert.alert(t("profile.signOutConfirmTitle"), t("profile.signOutConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.signOutConfirmButton"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
            try {
              await signOut();
            } finally {
              leave();
            }
          })();
        },
      },
    ]);
  }, [leave, signOut, t]);

  const confirmDeleteAccount = useCallback(() => {
    Alert.alert(t("legal.deleteAccount.confirmTitle"), t("legal.deleteAccount.confirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("legal.deleteAccount.confirmDelete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteAccount();
              leave();
            } catch (error) {
              Alert.alert(
                t("legal.deleteAccount.errorTitle"),
                userFacingErrorMessage(error, t, "legal.deleteAccount.errorFallback"),
              );
            }
          })();
        },
      },
    ]);
  }, [deleteAccount, leave, t]);

  return { confirmSignOut, confirmDeleteAccount };
}
