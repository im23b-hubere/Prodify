import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { useAuth } from "../../../context/AuthContext";
import { apiJson } from "../../../lib/client";

/** Sends a friend request from a locked profile, then lets the caller reload the relationship. */
export function useSendFriendRequest(onSent: () => Promise<void>) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [isSending, setIsSending] = useState(false);

  const send = useCallback(
    async (username: string) => {
      if (!token || isSending) return;
      setIsSending(true);
      try {
        await apiJson("/friends/request", { token, method: "POST", body: { username } });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        await onSent();
      } catch (error) {
        Alert.alert(
          t("friendsScreen.couldNotSend"),
          error instanceof Error ? error.message : t("friendsScreen.couldNotSend"),
        );
      } finally {
        setIsSending(false);
      }
    },
    [isSending, onSent, t, token],
  );

  return { send, isSending };
}
