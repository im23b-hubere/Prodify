import { useState } from "react";

import type { SessionType } from "../../../constants/sessionTypes";
import { useAuth } from "../../../context/AuthContext";
import type { SessionDto } from "../../../types/session";
import { ensureCredited } from "../creditList";
import { savedFocusReflection } from "../skillFocusReflection";
import { useFocusReflectionSelection } from "./useFocusReflectionSelection";
import { useSkillFocusSync } from "./useSkillFocusSync";
import { useSkillProgress } from "./useSkillProgress";

/**
 * Lets the user credit a finished session: a short list of focuses, minutes even-split until
 * they spin a row. Each change saves at once.
 */
export function useSessionFocusReflection(session: SessionDto, sessionType: SessionType) {
  const { token } = useAuth();
  const durationSeconds = session.duration_seconds ?? 0;
  const [savedReflection] = useState(() =>
    ensureCredited(savedFocusReflection(session, sessionType), durationSeconds),
  );
  const progress = useSkillProgress(token, session.id, savedReflection.focusIds.length > 0);
  const sync = useSkillFocusSync(
    { token, sessionId: session.id, sessionType },
    savedReflection,
    progress.refresh,
  );
  const selection = useFocusReflectionSelection(
    sessionType,
    savedReflection,
    sync.save,
    durationSeconds,
  );

  return {
    selection,
    hasPlannedFocus: savedReflection.focusIds.length > 0,
    progressBySkill: progress.progressBySkill,
    progressLoadState: progress.loadState,
    saveStatus: sync.status,
    retrySave: sync.retry,
  };
}

export type SessionFocusReflection = ReturnType<typeof useSessionFocusReflection>;
