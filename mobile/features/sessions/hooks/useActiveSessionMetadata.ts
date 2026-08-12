import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import type { SessionDto, SessionType } from "../../../types/session";
import { updateActiveSession } from "../services/activeSessionApi";

export const ACTIVE_NOTES_MAX_LENGTH = 2000;

type MetadataOptions = {
  token: string | null;
  session: SessionDto | null;
  setSession: Dispatch<SetStateAction<SessionDto | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function useActiveSessionMetadata(options: MetadataOptions) {
  const { t } = useTranslation();
  const { token, session, setSession, setError } = options;
  const [draftNotes, setDraftNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [metadataBusy, setMetadataBusy] = useState(false);

  useEffect(() => {
    setDraftNotes(session?.notes ?? "");
  }, [session?.id, session?.notes]);

  const saveNotes = useCallback(async () => {
    if (!token || !session) return;
    const notes = normalizedNotes(draftNotes);
    if (notes === (session.notes ?? "").trim()) return;
    setSavingNotes(true);
    try {
      const updated = await updateActiveSession(token, session.id, { notes: notes || null });
      if (updated) setSession(updated);
      else setError(t("sessionDetail.invalidResponse"));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("sessionActive.saveNotesFailed"));
    } finally {
      setSavingNotes(false);
    }
  }, [draftNotes, session, setError, setSession, t, token]);

  const setSessionType = useCallback(
    async (sessionType: SessionType) => {
      if (!token || !session || session.session_type === sessionType) return;
      setMetadataBusy(true);
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        const updated = await updateActiveSession(token, session.id, {
          session_type: sessionType,
        });
        if (updated) setSession(updated);
        else setError(t("sessionDetail.invalidResponse"));
      } catch (updateError) {
        setError(
          updateError instanceof Error ? updateError.message : t("sessionActive.updateFailed"),
        );
      } finally {
        setMetadataBusy(false);
      }
    },
    [session, setError, setSession, t, token],
  );

  return {
    draftNotes,
    setDraftNotes,
    savingNotes,
    metadataBusy,
    saveNotes,
    setSessionType,
  };
}

function normalizedNotes(notes: string): string {
  return notes.trim().slice(0, ACTIVE_NOTES_MAX_LENGTH);
}
