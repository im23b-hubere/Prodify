import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { mergeSessionPauseTiming, parseSessionDate } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";
import { pauseActiveSession, resumeActiveSession } from "../services/activeSessionApi";

type PauseControlsOptions = {
  token: string | null;
  session: SessionDto | null;
  setSession: (session: SessionDto | null) => void;
  setError: (error: string | null) => void;
  setNowMs: (nowMs: number) => void;
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

  const pause = useCallback(async (pauseOptions?: { atMs?: number; haptic?: boolean }) => {
    if (!token || !session || session.pause_started_at) return false;
    const previous = session;
    const pausedAtMs =
      typeof pauseOptions?.atMs === "number" && Number.isFinite(pauseOptions.atMs)
        ? pauseOptions.atMs
        : Date.now();
    const clientPauseStartedAt = new Date(pausedAtMs).toISOString();
    setNowMs(pausedAtMs);
    setSession({ ...session, pause_started_at: clientPauseStartedAt });
    setBusy(true);
    try {
      if (pauseOptions?.haptic !== false) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      }
      const updated = await pauseActiveSession(token, session.id, clientPauseStartedAt);
      if (updated) {
        setSession(mergeSessionPauseTiming(clientPauseStartedAt, updated));
        return true;
      }
      restoreAfterInvalidResponse(previous, t("sessionDetail.invalidResponse"));
      return false;
    } catch (pauseError) {
      restoreAfterInvalidResponse(
        previous,
        pauseError instanceof Error ? pauseError.message : t("sessionActive.pauseFailed"),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, [restoreAfterInvalidResponse, session, setNowMs, setSession, t, token]);

  const resume = useCallback(async (resumeOptions?: { haptic?: boolean }) => {
    if (!token || !session?.pause_started_at) return;
    const previous = session;
    const resumedAtMs = Date.now();
    setNowMs(resumedAtMs);
    setSession(optimisticResume(session, resumedAtMs));
    setBusy(true);
    try {
      if (resumeOptions?.haptic !== false) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      }
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
