import { useState } from "react";

import type { SessionType } from "../../../constants/sessionTypes";
import { useAuth } from "../../../context/AuthContext";
import type { SessionDto } from "../../../types/session";
import { savedFocusReflection } from "../skillFocusReflection";
import { useFocusReflectionSelection } from "./useFocusReflectionSelection";
import { useSkillFocusSync } from "./useSkillFocusSync";
import { useSkillProgress } from "./useSkillProgress";

/**
 * Lets the user confirm or correct what a finished session trained: every focus they touched,
 * optionally one main focus. Each change saves at once and refreshes the skill progress.
 */
export function useSessionFocusReflection(session: SessionDto, sessionType: SessionType) {
  const { token } = useAuth();
  const [savedReflection] = useState(() => savedFocusReflection(session, sessionType));
  const progress = useSkillProgress(token, session.id, savedReflection.focusIds.length > 0);
  const sync = useSkillFocusSync(
    { token, sessionId: session.id, sessionType },
    savedReflection,
    progress.refresh,
  );
  const selection = useFocusReflectionSelection(sessionType, savedReflection, sync.save);

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
