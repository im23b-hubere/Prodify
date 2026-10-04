import { useEffect } from "react";
import { AppState } from "react-native";

import { isE2eModeEnabled } from "../../../lib/e2eMode";
import { isChallengePushKind, requestChallengeSync, syncChallengesOnWrites } from "./challengeSync";

function pushKind(notification: unknown): unknown {
  const data = (notification as { request?: { content?: { data?: { kind?: unknown } } } } | null)
    ?.request?.content?.data;
  return data?.kind;
}

function useSyncOnForeground() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") requestChallengeSync("foreground");
    });
    return () => subscription.remove();
  }, []);
}

function useSyncOnChallengePush() {
  useEffect(() => {
    if (isE2eModeEnabled()) return;
    let mounted = true;
    let subscription: { remove: () => void } | undefined;
    void import("expo-notifications")
      .then((Notifications) => {
        if (!mounted) return;
        subscription = Notifications.addNotificationReceivedListener((notification) => {
          if (isChallengePushKind(pushKind(notification))) requestChallengeSync("changed");
        });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);
}

/** Turns app-wide events (writes, foreground, pushes) into one challenge refresh signal. */
export function ChallengeSyncBridge() {
  useEffect(() => syncChallengesOnWrites(), []);
  useSyncOnForeground();
  useSyncOnChallengePush();
  return null;
}
