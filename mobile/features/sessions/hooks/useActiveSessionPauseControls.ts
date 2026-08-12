import * as Haptics from "expo-haptics";
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import { mergeSessionPauseTiming, parseSessionDate } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";
import { pauseActiveSession, resumeActiveSession } from "../services/activeSessionApi";

type PauseControlsOptions = {
  token: string | null;
  session: SessionDto | null;
  setSession: Dispatch<SetStateAction<SessionDto | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNowMs: Dispatch<SetStateAction<number>>;
};

export function useActiveSessionPauseControls(options: PauseControlsOptions) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const { token, session, setSession, setError, setNowMs } = options;

  const restoreAfterInvalidResponse = useCallback(
    (previous: SessionDto, message: string) => {
      setSession(previous);
      setError(message);
    },
    [setError, setSession],
  );

  const pause = useCallback(async () => {
    if (!token || !session || session.pause_started_at) return;
    const previous = session;
    const pausedAtMs = Date.now();
    const clientPauseStartedAt = new Date(pausedAtMs).toISOString();
    setNowMs(pausedAtMs);
    setSession({ ...session, pause_started_at: clientPauseStartedAt });
    setBusy(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const updated = await pauseActiveSession(token, session.id);
      if (updated) setSession(mergeSessionPauseTiming(clientPauseStartedAt, updated));
      else restoreAfterInvalidResponse(previous, t("sessionDetail.invalidResponse"));
    } catch (pauseError) {
      restoreAfterInvalidResponse(
        previous,
        pauseError instanceof Error ? pauseError.message : t("sessionActive.pauseFailed"),
      );
    } finally {
      setBusy(false);
    }
  }, [restoreAfterInvalidResponse, session, setNowMs, setSession, t, token]);

  const resume = useCallback(async () => {
    if (!token || !session?.pause_started_at) return;
    const previous = session;
    const resumedAtMs = Date.now();
    setNowMs(resumedAtMs);
    setSession(optimisticResume(session, resumedAtMs));
    setBusy(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const updated = await resumeActiveSession(token, session.id);
      if (updated) setSession(updated);
      else restoreAfterInvalidResponse(previous, t("sessionDetail.invalidResponse"));
    } catch (resumeError) {
      restoreAfterInvalidResponse(
        previous,
        resumeError instanceof Error ? resumeError.message : t("sessionActive.resumeFailed"),
      );
    } finally {
      setBusy(false);
    }
  }, [restoreAfterInvalidResponse, session, setNowMs, setSession, t, token]);

  return { pause, resume, pauseResumeBusy: busy };
}

function optimisticResume(session: SessionDto, resumedAtMs: number): SessionDto {
  const pauseStartMs = parseSessionDate(session.pause_started_at ?? "").getTime();
  const additionalPaused = Number.isFinite(pauseStartMs)
    ? Math.max(0, Math.floor((resumedAtMs - pauseStartMs) / 1000))
    : 0;
  return {
    ...session,
    pause_started_at: null,
    paused_duration_seconds: (session.paused_duration_seconds ?? 0) + additionalPaused,
  };
}
