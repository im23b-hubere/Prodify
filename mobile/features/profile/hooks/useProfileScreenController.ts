import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { progressionOverviewHref } from "../../../lib/progressionNavigation";
import { openTab } from "../../../lib/stackNavigation";
import { useProfileData } from "./useProfileData";
import { useProfilePictureUpload } from "./useProfilePictureUpload";

export function useProfileScreenController() {
  const { t } = useTranslation();
  const { user, token, applyAuthenticatedUser } = useAuth();
  const router = useRouter();
  const userId = user?.id;
  const data = useProfileData(token, userId);
  const profilePicture = useProfilePictureUpload({ token, applyAuthenticatedUser });
  const openPublicProfile = useCallback(() => {
    if (userId) router.push(`/profile/${userId}`);
  }, [router, userId]);

  return {
    t,
    user,
    data,
    profilePicture,
    navigation: {
      openPublicProfile,
      openStats: () => openTab(router, "/(tabs)/stats"),
      openProgression: () => router.push(progressionOverviewHref("profile")),
      openSettings: () => router.push("/settings"),
    },
  };
}

export type ProfileScreenController = ReturnType<typeof useProfileScreenController>;
