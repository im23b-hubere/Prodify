import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState, type AppStateStatus } from "react-native";

import {
  beginSessionPresencePrompt,
  clearSessionLeftAtMs,
  decideSessionPresence,
  effectiveLeftAtMs,
  endSessionPresencePrompt,
  followPresencePause,
  abandonPresenceAttempt,
  isBackgroundAppState,
  isSessionRunning,
  markLongRunPrompted,
  noteSessionWentAway,
  peekSessionLeftAtMs,
  rememberPresencePause,
  wasLongRunPrompted,
} from "../../../lib/sessionPresence";
import { effectiveElapsedSeconds, parseSessionDate } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";

const LONG_RUN_POLL_MS = 15_000;

type SessionPresenceCheckInOptions = {
  session: SessionDto | null;
  sessionResolved: boolean;
  pauseAt: (pausedAtMs: number) => Promise<boolean | void>;
  applyLocalPause?: (pausedAtMs: number) => void;
  resume: () => void | Promise<void>;
  endSession: () => void;
};

export function useSessionPresenceCheckIn(options: SessionPresenceCheckInOptions) {
  const { t } = useTranslation();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const reconcileRef = useRef(() => Promise.resolve());

  reconcileRef.current = async () => {
    const { session, pauseAt, applyLocalPause } = optionsRef.current;
    const appIsActive = !isBackgroundAppState(String(AppState.currentState));

    if (!session) return;

    if (!isSessionRunning(session)) {
      if (appIsActive) clearSessionLeftAtMs();
      return;
    }

    if (!appIsActive) return;

    const nowMs = Date.now();
    const startedAtMs = parseSessionDate(session.started_at).getTime();
    const leftAtMs = effectiveLeftAtMs(peekSessionLeftAtMs(), startedAtMs);
    if (peekSessionLeftAtMs() != null && leftAtMs == null) clearSessionLeftAtMs();

    const decision = decideSessionPresence({
      isRunning: true,
      leftAtMs,
      nowMs,
      elapsedSeconds: effectiveElapsedSeconds(session, nowMs),
      longRunPrompted: wasLongRunPrompted(session.id),
    });

    if (decision.kind === "none") {
      const followAt = followPresencePause(session.id);
      if (followAt != null) applyLocalPause?.(followAt);
      else if (leftAtMs != null) clearSessionLeftAtMs();
      return;
    }

    if (!beginSessionPresencePrompt()) {
      const followAt = followPresencePause(session.id) ?? decision.pauseAtMs;
      applyLocalPause?.(followAt);
      return;
    }

    rememberPresencePause(session.id, decision.pauseAtMs);

    try {
      const paused = await pauseAt(decision.pauseAtMs);
      if (paused === false) {
        abandonPresenceAttempt(session.id, decision.reason);
        return;
      }
    } catch {
      abandonPresenceAttempt(session.id, decision.reason);
      return;
    }

    clearSessionLeftAtMs();
    if (decision.reason === "long-run") markLongRunPrompted(session.id);

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => undefined,
    );
    Alert.alert(
      t("sessionActive.stillThereTitle"),
      t("sessionActive.stillThereBody"),
      [
        {
          text: t("sessionActive.stillThereContinue"),
          onPress: () => {
            endSessionPresencePrompt();
            void optionsRef.current.resume();
          },
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
      if (isBackgroundAppState(next) && !isBackgroundAppState(previous)) {
        noteSessionWentAway(Date.now());
        return;
      }
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
    if (!isSessionRunning(options.session)) return;
    const interval = setInterval(() => void reconcileRef.current(), LONG_RUN_POLL_MS);
    return () => clearInterval(interval);
  }, [options.session?.id, options.session?.pause_started_at, options.session?.stopped_at]);
}
