import { useEffect } from "react";
import { AppState } from "react-native";

import { isE2eModeEnabled } from "../../../lib/e2eMode";
import { isFriendPushKind, requestFriendsSync, syncFriendsOnWrites } from "./friendsSync";

function pushKind(notification: unknown): unknown {
  const data = (notification as { request?: { content?: { data?: { kind?: unknown } } } } | null)
    ?.request?.content?.data;
  return data?.kind;
}

function useSyncOnForeground() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") requestFriendsSync("foreground");
    });
    return () => subscription.remove();
  }, []);
}

function useSyncOnFriendPush() {
  useEffect(() => {
    if (isE2eModeEnabled()) return;
    let mounted = true;
    let subscription: { remove: () => void } | undefined;
    void import("expo-notifications")
      .then((Notifications) => {
        if (!mounted) return;
        subscription = Notifications.addNotificationReceivedListener((notification) => {
          if (isFriendPushKind(pushKind(notification))) requestFriendsSync("changed");
        });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);
}

/** Turns app-wide events (writes, foreground, pushes) into one friends refresh signal. */
export function FriendsSyncBridge() {
  useEffect(() => syncFriendsOnWrites(), []);
  useSyncOnForeground();
  useSyncOnFriendPush();
  return null;
}
