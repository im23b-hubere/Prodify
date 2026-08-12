import { useFocusEffect } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

import { PENDING_SESSION_SETUP_KEY } from "../../../constants/sessionUi";
import {
  LAST_KNOWN_STREAK_KEY,
  MILESTONE_CELEBRATED_MAX_KEY,
  userScopedLastKnownStreakKey,
  userScopedMilestoneCelebratedKey,
} from "../../../constants/storageKeys";
import { getUnreadCount, syncServerInbox } from "../../../lib/notificationInbox";
import { registerPushTokenWithBackend } from "../../../lib/pushToken";

type UseDashboardLifecycleOptions = {
  token?: string | null;
  userId?: number | null;
  refreshDashboard: (options: { withLoading: boolean }) => Promise<unknown>;
  presentSessionSetup: () => void;
};

export function useDashboardLifecycle({
  token,
  userId,
  refreshDashboard,
  presentSessionSetup,
}: UseDashboardLifecycleOptions) {
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const refreshUnreadCount = useCallback(() => {
    getUnreadCount()
      .then(setNotificationUnreadCount)
      .catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        syncServerInbox(token, 30)
          .then(refreshUnreadCount)
          .catch(() => undefined);
      }
      refreshDashboard({ withLoading: false }).catch(() => undefined);
      refreshUnreadCount();
      openPendingSessionSetup(presentSessionSetup);
    }, [presentSessionSetup, refreshDashboard, refreshUnreadCount, token]),
  );

  useEffect(() => {
    if (token) registerPushTokenWithBackend(token).catch(() => undefined);
  }, [token]);

  return {
    notificationUnreadCount,
    refreshUnreadCount,
    userScopedStreakKey: userId ? userScopedLastKnownStreakKey(userId) : LAST_KNOWN_STREAK_KEY,
    userScopedMilestoneKey: userId
      ? userScopedMilestoneCelebratedKey(userId)
      : MILESTONE_CELEBRATED_MAX_KEY,
  };
}

function openPendingSessionSetup(presentSessionSetup: () => void) {
  SecureStore.getItemAsync(PENDING_SESSION_SETUP_KEY)
    .then(async (pending) => {
      if (pending !== "1") return;
      await SecureStore.deleteItemAsync(PENDING_SESSION_SETUP_KEY);
      presentSessionSetup();
    })
    .catch(() => undefined);
}
