import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import type { AuthenticatedUser } from "../../../lib/authSessionService";
import { uploadProfilePicture } from "../../../lib/profilePictureUpload";
import { userFacingErrorMessage } from "../../../lib/userFacingErrorMessage";

type Options = {
  token: string | null;
  applyAuthenticatedUser: (user: AuthenticatedUser) => void;
};

export function useProfilePictureUpload({ token, applyAuthenticatedUser }: Options) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const pickAndUpload = useCallback(async () => {
    if (busy) return;
    if (!token?.trim()) {
      Alert.alert(t("common.oops"), t("profile.photoUploadSignedOut"));
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("profile.photoPermissionTitle"), t("profile.photoPermissionBody"));
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.88,
    });
    if (picked.canceled || !picked.assets[0]?.uri) return;

    const asset = picked.assets[0];
    setBusy(true);
    try {
      const updated = await uploadProfilePicture(token, {
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      });
      applyAuthenticatedUser(updated);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch (error) {
      Alert.alert(
        t("profile.photoUploadFailedTitle"),
        userFacingErrorMessage(error, t, "profile.photoUploadFailed"),
      );
    } finally {
      setBusy(false);
    }
  }, [applyAuthenticatedUser, busy, t, token]);

  return { busy, pickAndUpload };
}
