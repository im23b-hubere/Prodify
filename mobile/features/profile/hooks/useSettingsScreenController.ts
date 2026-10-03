import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { useProfileAccountActions } from "./useProfileAccountActions";

/** Everything the settings screen offers: notification preferences, legal links and the account. */
export function useSettingsScreenController() {
  const { t } = useTranslation();
  const { signOut, deleteAccount } = useAuth();
  const router = useRouter();
  const accountActions = useProfileAccountActions({ signOut, deleteAccount });

  return {
    t,
    accountActions,
    navigation: {
      goBack: () => router.back(),
      openNotifications: () =>
        router.push({ pathname: "/notifications", params: { source: "profile" } }),
      openPrivacy: () => router.push("/legal/privacy" as never),
      openTerms: () => router.push("/legal/terms" as never),
    },
  };
}

export type SettingsScreenController = ReturnType<typeof useSettingsScreenController>;
