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
import { openElapsedSeconds } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";

const PRESENCE_POLL_MS = 15_000;

type SessionPresenceCheckInOptions = {
  session: SessionDto | null;
  sessionResolved: boolean;
  endSession: () => void | boolean | Promise<void | boolean>;
  /** Off while the screen is covered: its session copy may be stale (e.g. paused elsewhere). */
  enabled?: boolean;
};

export function useSessionPresenceCheckIn(options: SessionPresenceCheckInOptions) {
  const { t } = useTranslation();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const reconcileRef = useRef(() => Promise.resolve());
  const enabled = options.enabled ?? true;
  const watchedSession = enabled ? options.session : null;

  reconcileRef.current = async () => {
    const { session, enabled: isEnabled = true } = optionsRef.current;
    if (!isEnabled || !session || session.stopped_at) return;
    if (isBackgroundAppState(String(AppState.currentState))) return;

    const decision = decideSessionPresence({
      isRunning: isSessionRunning(session),
      elapsedSeconds: openElapsedSeconds(session, Date.now()),
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
  }, [watchedSession, options.sessionResolved]);

  const watchedSessionRef = useRef(watchedSession);
  watchedSessionRef.current = watchedSession;
  const scheduleKey = presenceScheduleKey(watchedSession);
  useEffect(() => {
    if (!enabled) return;
    void syncSessionPresenceNotifications(watchedSessionRef.current);
  }, [enabled, scheduleKey]);

  const isOpen = Boolean(watchedSession && !watchedSession.stopped_at);
  const watchedSessionId = watchedSession?.id;
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => void reconcileRef.current(), PRESENCE_POLL_MS);
    return () => clearInterval(interval);
  }, [isOpen, watchedSessionId]);
}

/** Changes exactly when the local presence reminders would fire at different times. */
function presenceScheduleKey(session: SessionDto | null) {
  if (!session) return "none";
  return [
    session.id,
    session.started_at,
    session.pause_started_at,
    session.stopped_at,
    session.paused_duration_seconds,
  ].join("|");
}
