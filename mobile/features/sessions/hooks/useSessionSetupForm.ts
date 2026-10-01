import { useTranslation } from "react-i18next";

import type { SessionType } from "../../../constants/sessionTypes";
import { useAuth } from "../../../context/AuthContext";
import type { SessionDto } from "../../../types/session";
import { useFocusSuggestions } from "./useFocusSuggestions";
import { useSessionSetupFields } from "./useSessionSetupFields";
import { useSkillFocusFields } from "./useSkillFocusFields";
import { useStartSession } from "./useStartSession";

type Options = {
  initialSessionType: SessionType | null;
  onStarted: (session: SessionDto) => void;
  onActiveSessionConflict?: (sessionId?: number) => void;
};

export function useSessionSetupForm({
  initialSessionType,
  onStarted,
  onActiveSessionConflict,
}: Options) {
  const { t } = useTranslation();
  const { token, hydrated } = useAuth();
  const fields = useSessionSetupFields(initialSessionType, t);
  const focus = useSkillFocusFields(fields.selectedType);
  const focusSuggestions = useFocusSuggestions(token, fields.selectedType);
  const start = useStartSession({
    token,
    hydrated,
    selectedType: fields.selectedType,
    notes: fields.notes,
    mood: fields.mood,
    tags: fields.tags,
    skillFocusIds: focus.focusIds,
    suggestedFocusIds: focusSuggestions.map(({ id }) => id),
    t,
    onStarted,
    onConflict: onActiveSessionConflict,
  });
  return { ...fields, ...focus, ...start, focusSuggestions, hydrated };
}

export type SessionSetupFormState = ReturnType<typeof useSessionSetupForm>;
