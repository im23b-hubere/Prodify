import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import { apiJson } from "../../../lib/client";
import { tryParseSessionDto } from "../../../lib/sessionDto";
import { DEFAULT_SESSION_TYPE, type SessionDto, type SessionType } from "../../../types/session";

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

function useSessionDraft(session: SessionDto | null, currentUserId?: number | null) {
  const [selectedType, setSelectedType] = useState<SessionType>(DEFAULT_SESSION_TYPE);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!session) return;
    setSelectedType((session.session_type as SessionType) || DEFAULT_SESSION_TYPE);
    setNote(session.notes ?? "");
  }, [session]);

  const isDirty = useMemo(() => {
    if (!session || currentUserId == null || session.user_id !== currentUserId) return false;
    const savedType = (session.session_type as SessionType) || DEFAULT_SESSION_TYPE;
    return selectedType !== savedType || note.trim() !== (session.notes?.trim() ?? "");
  }, [currentUserId, note, selectedType, session]);

  return { selectedType, setSelectedType, note, setNote, isDirty };
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
  const { selectedType, setSelectedType, note, setNote, isDirty } = useSessionDraft(
    session,
    currentUserId,
  );
  const [busy, setBusy] = useState(false);

  const save = useCallback(async () => {
    if (!token || !sessionId) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const response = await apiJson<unknown>(`/sessions/item/${sessionId}`, {
        token,
        method: "PATCH",
        body: {
          session_type: selectedType,
          notes: note.trim() || null,
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
  }, [note, onClose, onError, onSessionUpdated, selectedType, sessionId, t, token]);

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
    busy,
    isDirty,
    save,
    confirmDelete,
  };
}
