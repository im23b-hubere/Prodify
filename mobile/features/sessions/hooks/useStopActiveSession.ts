import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { formatDurationWords } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";
import { stopActiveSession } from "../services/activeSessionApi";

type StopSessionOptions = {
  token: string | null;
  session: SessionDto | null;
  elapsed: number;
  reload: () => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function useStopActiveSession(options: StopSessionOptions) {
  const { t } = useTranslation();
  const router = useRouter();
  const stopInFlight = useRef(false);
  const [stopBusy, setStopBusy] = useState(false);
  const { token, session, elapsed, reload, setError } = options;

  const finishSession = useCallback(
    async (sessionId: number) => {
      if (!token || stopInFlight.current) return;
      stopInFlight.current = true;
      setStopBusy(true);
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
        await stopActiveSession(token, sessionId);
        router.replace({ pathname: "/session/complete", params: { id: String(sessionId) } });
      } catch (stopError) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        setError(stopError instanceof Error ? stopError.message : t("sessionActive.stopFailed"));
        void reload();
      } finally {
        stopInFlight.current = false;
        setStopBusy(false);
      }
    },
    [reload, router, setError, t, token],
  );

  const confirmStop = useCallback(() => {
    if (!session || stopInFlight.current) return;
    const sessionId = session.id;
    Alert.alert(
      t("dashboard.endSessionTitle"),
      t("dashboard.endSessionWorked", { duration: formatDurationWords(elapsed) }),
      [
        { text: t("dashboard.keepGoing"), style: "cancel" },
        {
          text: t("dashboard.endSessionConfirm"),
          style: "destructive",
          onPress: () => finishSession(sessionId),
        },
      ],
    );
  }, [elapsed, finishSession, session, t]);

  return { confirmStop, stopBusy };
}
