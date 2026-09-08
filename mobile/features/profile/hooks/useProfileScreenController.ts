import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { progressionOverviewHref } from "../../../lib/progressionNavigation";
import { useProfileAccountActions } from "./useProfileAccountActions";
import { useProfileData } from "./useProfileData";
import { useProfilePushTest } from "./useProfilePushTest";

export function useProfileScreenController() {
  const { t } = useTranslation();
  const { user, signOut, deleteAccount, token } = useAuth();
  const router = useRouter();
  const userId = user?.id;
  const data = useProfileData(token, userId);
  const accountActions = useProfileAccountActions({ signOut, deleteAccount });
  const pushTest = useProfilePushTest(token);
  const openPublicProfile = useCallback(() => {
    if (userId) router.push(`/profile/${userId}`);
  }, [router, userId]);

  return {
    t,
    user,
    data,
    accountActions,
    pushTest,
    navigation: {
      openPublicProfile,
      openStats: () => router.push("/(tabs)/stats"),
      openProgression: () => router.push(progressionOverviewHref("profile")),
      openNotifications: () =>
        router.push({ pathname: "/notifications", params: { source: "profile" } }),
      openPrivacy: () => router.push("/legal/privacy" as never),
      openTerms: () => router.push("/legal/terms" as never),
    },
  };
}

export type ProfileScreenController = ReturnType<typeof useProfileScreenController>;
