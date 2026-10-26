import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";

import { openLegalPage } from "../../../constants/legal";
import { useAuth } from "../../../context/AuthContext";
import {
  APP_LANGUAGE_DEFINITIONS,
  FALLBACK_APP_LANGUAGE,
  isAppLanguage,
} from "../../../lib/i18nLanguages";
import { openSubscriptionManagement } from "../../../lib/revenuecat";
import { useProfileAccountActions } from "./useProfileAccountActions";

/** Everything the settings screen offers: language, notification preferences, legal links and the account. */
export function useSettingsScreenController() {
  const { t, i18n } = useTranslation();
  const { signOut, deleteAccount } = useAuth();
  const router = useRouter();
  const accountActions = useProfileAccountActions({ signOut, deleteAccount });
  const active = i18n.resolvedLanguage;
  const languageName =
    APP_LANGUAGE_DEFINITIONS[isAppLanguage(active) ? active : FALLBACK_APP_LANGUAGE].nativeName;

  return {
    t,
    accountActions,
    languageName,
    navigation: {
      goBack: () => router.back(),
      // The language is picked per app in the phone's settings, which this opens.
      openLanguageSettings: () => {
        void Linking.openSettings();
      },
      openNotifications: () =>
        router.push({ pathname: "/notifications", params: { source: "profile" } }),
      openSubscriptionManagement: () => void openSubscriptionManagement(),
      openPrivacy: () => openLegalPage("privacy"),
      openTerms: () => openLegalPage("terms"),
      openImprint: () => openLegalPage("imprint"),
      openBlockedUsers: () => router.push("/blocked-users" as never),
      openEngagementDebug: () => router.push("/engagement-debug" as never),
    },
  };
}

export type SettingsScreenController = ReturnType<typeof useSettingsScreenController>;
