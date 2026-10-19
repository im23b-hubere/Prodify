import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { useAuth } from "../../../context/AuthContext";
import { apiJson } from "../../../lib/client";
import { userFacingErrorMessage } from "../../../lib/userFacingErrorMessage";

type Options = {
  /** Confirm before deleting an accepted friendship; pending withdraw skips confirm. */
  confirm?: boolean;
  name?: string | null;
};

/** Deletes a friendship row — withdraw pending, decline, or unfriend accepted. */
export function useRemoveFriendship(onRemoved: () => Promise<void> | void) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [isRemoving, setIsRemoving] = useState(false);
  const inFlight = useRef(false);

  const remove = useCallback(
    async (friendshipId: number, options: Options = {}) => {
      if (!token || inFlight.current) return;
      const run = async () => {
        inFlight.current = true;
        setIsRemoving(true);
        try {
          await apiJson(`/friends/${friendshipId}`, { token, method: "DELETE" });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          await onRemoved();
        } catch (error) {
          Alert.alert(
            t("friendProfile.removeFailed"),
            userFacingErrorMessage(error, t, "friendProfile.removeFailed"),
          );
        } finally {
          inFlight.current = false;
          setIsRemoving(false);
        }
      };

      if (!options.confirm) {
        await run();
        return;
      }
      Alert.alert(
        t("friendProfile.unfriendTitle"),
        t("friendProfile.unfriendBody", { name: options.name ?? "" }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("friendProfile.unfriendConfirm"),
            style: "destructive",
            onPress: () => void run(),
          },
        ],
      );
    },
    [onRemoved, t, token],
  );

  return { remove, isRemoving };
}
