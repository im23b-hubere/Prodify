import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState, type AppStateStatus } from "react-native";

import {
  abandonSessionAutoStop,
  beginSessionAutoStop,
  beginSessionPresencePrompt,
  decideSessionPresence,
  endSessionPresencePrompt,
  isBackgroundAppState,
  isSessionRunning,
  markStillTherePrompted,
  wasStillTherePrompted,
} from "../../../lib/sessionPresence";
import { syncSessionPresenceNotifications } from "../../../lib/sessionPresenceNotifications";
import { effectiveElapsedSeconds } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";

const PRESENCE_POLL_MS = 15_000;

type SessionPresenceCheckInOptions = {
  session: SessionDto | null;
  sessionResolved: boolean;
  endSession: () => void | boolean | Promise<void | boolean>;
};

export function useSessionPresenceCheckIn(options: SessionPresenceCheckInOptions) {
  const { t } = useTranslation();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const reconcileRef = useRef(() => Promise.resolve());

  reconcileRef.current = async () => {
    const { session } = optionsRef.current;
    if (!session || !isSessionRunning(session)) return;
    if (isBackgroundAppState(String(AppState.currentState))) return;

    const decision = decideSessionPresence({
      isRunning: true,
      elapsedSeconds: effectiveElapsedSeconds(session, Date.now()),
      stillTherePrompted: wasStillTherePrompted(session.id),
    });
    if (decision.kind === "none") return;

    if (decision.kind === "auto-stop") {
      if (!beginSessionAutoStop(session.id)) return;
      const stopped = await Promise.resolve(optionsRef.current.endSession());
      if (stopped === false) abandonSessionAutoStop(session.id);
      return;
    }

    if (!beginSessionPresencePrompt()) return;
    markStillTherePrompted(session.id);

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => undefined,
    );
    Alert.alert(
      t("sessionActive.stillThereTitle"),
      t("sessionActive.stillThereBody"),
      [
        {
          text: t("sessionActive.stillThereContinue"),
          onPress: endSessionPresencePrompt,
        },
        {
          text: t("sessionActive.stillThereEnd"),
          style: "destructive",
          onPress: () => {
            endSessionPresencePrompt();
            optionsRef.current.endSession();
          },
        },
      ],
      { cancelable: true, onDismiss: endSessionPresencePrompt },
    );
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      const previous = appState.current;
      appState.current = next;
      if (next === "active" && isBackgroundAppState(previous)) {
        void reconcileRef.current();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    void reconcileRef.current();
  }, [options.session, options.sessionResolved]);

  useEffect(() => {
    void syncSessionPresenceNotifications(options.session);
  }, [
    options.session?.id,
    options.session?.started_at,
    options.session?.pause_started_at,
    options.session?.stopped_at,
    options.session?.paused_duration_seconds,
  ]);

  useEffect(() => {
    if (!isSessionRunning(options.session)) return;
    const interval = setInterval(() => void reconcileRef.current(), PRESENCE_POLL_MS);
    return () => clearInterval(interval);
  }, [options.session?.id, options.session?.pause_started_at, options.session?.stopped_at]);
}
