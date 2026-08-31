import { useMemo } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { sessionTagsList } from "../../../lib/sessionDto";
import { formatDurationWords } from "../../../lib/sessionTime";
import { useActiveSessionClock } from "./useActiveSessionClock";
import { useActiveSessionLoader } from "./useActiveSessionLoader";
import { useActiveSessionMetadata } from "./useActiveSessionMetadata";
import { useActiveSessionPauseControls } from "./useActiveSessionPauseControls";
import { useStopActiveSession } from "./useStopActiveSession";

export { ACTIVE_NOTES_MAX_LENGTH } from "./useActiveSessionMetadata";

export function useActiveSession(id: string | undefined) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const loader = useActiveSessionLoader(token, user?.id, id);
  const clock = useActiveSessionClock(loader.session);
  const pauseControls = useActiveSessionPauseControls({
    token,
    session: loader.session,
    setSession: loader.setSession,
    setError: loader.setError,
    setNowMs: clock.setNowMs,
  });
  const metadata = useActiveSessionMetadata({
    token,
    session: loader.session,
    setSession: loader.setSession,
    setError: loader.setError,
  });
  const stop = useStopActiveSession({
    token,
    session: loader.session,
    elapsed: clock.elapsed,
    reload: loader.load,
    setError: loader.setError,
  });
  const insightLine = useMemo(
    () => sessionInsight(clock.elapsed, loader.longestCompletedSeconds, t),
    [clock.elapsed, loader.longestCompletedSeconds, t],
  );

  return {
    session: loader.session,
    loading: loader.loading,
    error: loader.error,
    busy: pauseControls.pauseResumeBusy || metadata.metadataBusy || stop.stopBusy,
    elapsed: clock.elapsed,
    isPaused: Boolean(loader.session?.pause_started_at),
    draftNotes: metadata.draftNotes,
    setDraftNotes: metadata.setDraftNotes,
    savingNotes: metadata.savingNotes,
    tagList: sessionTagsList(loader.session?.tags),
    insightLine,
    load: loader.load,
    pause: pauseControls.pause,
    resume: pauseControls.resume,
    saveNotes: metadata.saveNotes,
    setSessionType: metadata.setSessionType,
    confirmStop: stop.confirmStop,
  };
}

function sessionInsight(
  elapsed: number,
  longestCompletedSeconds: number | null,
  t: TFunction,
): string {
  if (longestCompletedSeconds == null) return t("sessionActive.insightDefault");
  return elapsed > longestCompletedSeconds
    ? t("sessionActive.insightPastBest", {
        prev: formatDurationWords(longestCompletedSeconds),
      })
    : t("sessionActive.insightLongest", {
        duration: formatDurationWords(longestCompletedSeconds),
      });
}
