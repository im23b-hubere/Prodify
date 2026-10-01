import { useMemo } from "react";

import type { SessionType } from "../../../constants/sessionTypes";
import { buildSkillTreeModel } from "../../skills/skillTreePresentation";
import { useSkillProfile } from "../../skills/hooks/useSkillProfile";
import { suggestFocuses, type FocusSuggestion } from "../focusSuggestions";

const NO_SUGGESTIONS: FocusSuggestion[] = [];

/** Suggestions stay empty until the profile loads and whenever it fails, so nothing flickers. */
export function useFocusSuggestions(
  token: string | null | undefined,
  sessionType: SessionType | null,
): FocusSuggestion[] {
  const { profile, loadState } = useSkillProfile(token);
  const isReady = loadState === "ready" && profile !== null;

  return useMemo(() => {
    if (!isReady || !sessionType) return NO_SUGGESTIONS;
    return suggestFocuses(buildSkillTreeModel(profile), sessionType, new Date());
  }, [isReady, profile, sessionType]);
}
