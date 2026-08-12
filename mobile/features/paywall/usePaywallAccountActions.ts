import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { ApiError } from "../../lib/client";

type PaywallAccountActionsOptions = {
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  exitToLogin: () => void;
};

export function usePaywallAccountActions({
  signOut,
  deleteAccount,
  exitToLogin,
}: PaywallAccountActionsOptions) {
  const { t } = useTranslation();

  const confirmLogout = useCallback(() => {
    Alert.alert(t("profile.signOutConfirmTitle"), t("profile.signOutConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.signOutConfirmButton"),
        style: "destructive",
        onPress: () => {
          void signOut().finally(exitToLogin);
        },
      },
    ]);
  }, [exitToLogin, signOut, t]);

  const confirmDeleteAccount = useCallback(() => {
    Alert.alert(t("legal.deleteAccount.confirmTitle"), t("legal.deleteAccount.confirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("legal.deleteAccount.confirmDelete"),
        style: "destructive",
        onPress: () => {
          void deleteAccount()
            .then(exitToLogin)
            .catch((error) => {
              const message =
                error instanceof ApiError
                  ? error.message
                  : error instanceof Error
                    ? error.message
                    : t("legal.deleteAccount.errorFallback");
              Alert.alert(t("legal.deleteAccount.errorTitle"), message);
            });
        },
      },
    ]);
  }, [deleteAccount, exitToLogin, t]);

  return { confirmLogout, confirmDeleteAccount };
}
