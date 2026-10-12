import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback } from "react";
import { Alert } from "react-native";

import { blockUser } from "../../../lib/moderation";
import { confirmBlock } from "../confirmBlock";

export type BlockTarget = { userId: number; name: string };

/** Asks first, then blocks; `onBlocked` runs only once the server agreed. */
export function useBlockUser(token: string | null | undefined, t: TFunction) {
  return useCallback(
    (target: BlockTarget, onBlocked: () => void) => {
      if (!token) return;
      confirmBlock({
        name: target.name,
        t,
        onConfirm: () => {
          blockUser(token, target.userId)
            .then(() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              onBlocked();
            })
            .catch(() => Alert.alert(t("safety.block.failedTitle"), t("common.tryAgain")));
        },
      });
    },
    [t, token],
  );
}
