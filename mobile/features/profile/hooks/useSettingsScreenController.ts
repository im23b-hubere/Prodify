import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { useLanguagePreference } from "./useLanguagePreference";
import { useProfileAccountActions } from "./useProfileAccountActions";

/** Everything the settings screen offers: language, notification preferences, legal links and the account. */
export function useSettingsScreenController() {
  const { t } = useTranslation();
  const { signOut, deleteAccount } = useAuth();
  const router = useRouter();
  const accountActions = useProfileAccountActions({ signOut, deleteAccount });
  const language = useLanguagePreference();

  return {
    t,
    accountActions,
    language,
    navigation: {
      goBack: () => router.back(),
      openNotifications: () =>
        router.push({ pathname: "/notifications", params: { source: "profile" } }),
      openPrivacy: () => router.push("/legal/privacy" as never),
      openTerms: () => router.push("/legal/terms" as never),
      openImprint: () => router.push("/legal/imprint" as never),
      openBlockedUsers: () => router.push("/blocked-users" as never),
      openEngagementDebug: () => router.push("/engagement-debug" as never),
    },
  };
}

export type SettingsScreenController = ReturnType<typeof useSettingsScreenController>;
