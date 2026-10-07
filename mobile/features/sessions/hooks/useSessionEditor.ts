import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";

import { apiJson } from "../../../lib/client";
import { tryParseSessionDto } from "../../../lib/sessionDto";
import { DEFAULT_SESSION_TYPE, type SessionDto, type SessionType } from "../../../types/session";
import { focusReflectionPayload } from "../focusReflectionPayload";
import {
  fitReflectionToSessionType,
  isSameReflection,
  storedFocusReflection,
  type FocusReflection,
} from "../skillFocusReflection";
import { useFocusReflectionSelection } from "./useFocusReflectionSelection";

type UseSessionEditorOptions = {
  token?: string | null;
  sessionId?: string;
  session: SessionDto | null;
  currentUserId?: number | null;
  t: TFunction;
  onSessionUpdated: (session: SessionDto) => void;
  onClose: () => void;
  onError: (message: string) => void;
};

const NO_REFLECTION: FocusReflection = { focusIds: [], primaryFocusId: null, areaWeights: {} };

/** Unfitted on purpose: switching the type back in the editor restores what was stored. */
function storedReflection(session: SessionDto | null): FocusReflection {
  return session ? storedFocusReflection(session) : NO_REFLECTION;
}

function useSessionDraft(session: SessionDto | null, currentUserId?: number | null) {
  const [selectedType, setSelectedType] = useState<SessionType>(DEFAULT_SESSION_TYPE);
  const [note, setNote] = useState("");

  // The session loads asynchronously and is replaced on every save, so the draft re-seeds
  // whenever a different session object arrives. Doing it while rendering rather than in an
  // effect means the form never paints one frame of the previous session's values.
  const [seededFrom, setSeededFrom] = useState<SessionDto | null>(null);
  if (session && session !== seededFrom) {
    setSeededFrom(session);
    setSelectedType((session.session_type as SessionType) || DEFAULT_SESSION_TYPE);
    setNote(session.notes ?? "");
  }

  const savedReflection = useMemo(() => storedReflection(session), [session]);
  const focusSelection = useFocusReflectionSelection(
    selectedType,
    savedReflection,
    undefined,
    session?.duration_seconds ?? 0,
  );
  const isOwnSession = !!session && currentUserId != null && session.user_id === currentUserId;
  const canEditFocuses = isOwnSession && session?.stopped_at != null;

  const savedType = (session?.session_type as SessionType) || DEFAULT_SESSION_TYPE;
  const hasFocusChanges =
    canEditFocuses &&
    !isSameReflection(
      focusSelection.committedReflection,
      fitReflectionToSessionType(savedReflection, selectedType),
    );
  const isDirty =
    isOwnSession &&
    (selectedType !== savedType ||
      note.trim() !== (session?.notes?.trim() ?? "") ||
      hasFocusChanges);

  return {
    selectedType,
    setSelectedType,
    note,
    setNote,
    focusSelection,
    canEditFocuses,
    hasFocusChanges,
    isDirty,
  };
}

export function useSessionEditor({
  token,
  sessionId,
  session,
  currentUserId,
  t,
  onSessionUpdated,
  onClose,
  onError,
}: UseSessionEditorOptions) {
  const {
    selectedType,
    setSelectedType,
    note,
    setNote,
    focusSelection,
    canEditFocuses,
    hasFocusChanges,
    isDirty,
  } = useSessionDraft(session, currentUserId);
  const [busy, setBusy] = useState(false);
  const { committedReflection } = focusSelection;

  const save = useCallback(async () => {
    if (!token || !sessionId) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const focusFields = hasFocusChanges
        ? focusReflectionPayload(committedReflection, selectedType)
        : {};
      const response = await apiJson<unknown>(`/sessions/item/${sessionId}`, {
        token,
        method: "PATCH",
        body: {
          session_type: selectedType,
          notes: note.trim() || null,
          ...focusFields,
        },
      });
      const updatedSession = tryParseSessionDto(response);
      if (!updatedSession) {
        onError(t("sessionDetail.invalidResponse"));
        return;
      }
      onSessionUpdated(updatedSession);
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : t("sessionDetail.saveFailed"));
    } finally {
      setBusy(false);
    }
  }, [
    committedReflection,
    hasFocusChanges,
    note,
    onClose,
    onError,
    onSessionUpdated,
    selectedType,
    sessionId,
    t,
    token,
  ]);

  const confirmDelete = useCallback(() => {
    if (!token || !sessionId) return;
    Alert.alert(t("sessionDetail.deleteTitle"), t("sessionDetail.deleteBody"), [
      { text: t("sessionDetail.cancel"), style: "cancel" },
      {
        text: t("sessionDetail.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await apiJson(`/sessions/item/${sessionId}`, { token, method: "DELETE" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
            onClose();
          } catch (error) {
            onError(error instanceof Error ? error.message : t("sessionDetail.deleteFailed"));
          }
        },
      },
    ]);
  }, [onClose, onError, sessionId, t, token]);

  return {
    selectedType,
    setSelectedType,
    note,
    setNote,
    focusSelection,
    canEditFocuses,
    busy,
    isDirty,
    save,
    confirmDelete,
  };
}
