import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { ApiError } from "../../../lib/client";

type UseProfileAccountActionsOptions = {
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

export function useProfileAccountActions({
  signOut,
  deleteAccount,
}: UseProfileAccountActionsOptions) {
  const { t } = useTranslation();
  const router = useRouter();

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
              router.replace("/(auth)/login");
            }
          })();
        },
      },
    ]);
  }, [router, signOut, t]);

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
              router.replace("/(auth)/login");
            } catch (error) {
              const message =
                error instanceof ApiError
                  ? error.message
                  : error instanceof Error
                    ? error.message
                    : t("legal.deleteAccount.errorFallback");
              Alert.alert(t("legal.deleteAccount.errorTitle"), message);
            }
          })();
        },
      },
    ]);
  }, [deleteAccount, router, t]);

  return { confirmSignOut, confirmDeleteAccount };
}
