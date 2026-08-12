import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import type { SessionType } from "../../../constants/sessionTypes";
import { useAuth } from "../../../context/AuthContext";
import { ApiError, apiJson } from "../../../lib/client";
import { debugLog } from "../../../lib/debugLog";
import { tryParseSessionDto } from "../../../lib/sessionDto";
import type { SessionDto } from "../../../types/session";

const SUGGESTED_TAGS = ["trap", "drill", "techno", "house", "experimental"];
const SUBMIT_COOLDOWN_MS = 800;

type UseSessionSetupFormOptions = {
  initialSessionType: SessionType | null;
  onStarted: (session: SessionDto) => void;
  onActiveSessionConflict?: (sessionId?: number) => void;
};

function conflictSessionId(error: ApiError): number | null {
  const payload = error.payload as { detail?: unknown; session_id?: unknown } | null;
  const detail =
    payload && typeof payload.detail === "object" && payload.detail !== null
      ? (payload.detail as { session_id?: unknown })
      : null;
  const candidate = payload?.session_id ?? detail?.session_id;
  return typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0
    ? candidate
    : null;
}

export function useSessionSetupForm({
  initialSessionType,
  onStarted,
  onActiveSessionConflict,
}: UseSessionSetupFormOptions) {
  const { t } = useTranslation();
  const { token, hydrated } = useAuth();
  const mounted = useRef(true);
  const requestInFlight = useRef(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedType, setSelectedType] = useState<SessionType | null>(initialSessionType);
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (cooldown.current) clearTimeout(cooldown.current);
    };
  }, []);

  useEffect(() => {
    if (initialSessionType) setSelectedType(initialSessionType);
  }, [initialSessionType]);

  const addTag = useCallback(
    (rawTag: string) => {
      const tag = rawTag.trim().toLowerCase();
      if (!tag) return;
      if (tag.length > 32) {
        setTagError(t("sessionSetup.tagTooLong"));
        return;
      }
      if (tags.length >= 20) {
        setTagError(t("sessionSetup.tagLimitReached"));
        return;
      }
      if (tags.includes(tag)) {
        setTagError(t("sessionSetup.tagAlreadyAdded"));
        return;
      }
      setTags((current) => [...current, tag]);
      setTagInput("");
      setTagError(null);
    },
    [t, tags],
  );

  const resolveConflict = useCallback(
    async (error: ApiError, authToken: string) => {
      const sessionId = conflictSessionId(error);
      if (!sessionId) {
        onActiveSessionConflict?.();
        return false;
      }
      try {
        const raw = await apiJson<unknown>(`/sessions/item/${sessionId}`, { token: authToken });
        const activeSession = tryParseSessionDto(raw);
        if (activeSession) {
          Alert.alert(t("sessionSetup.activeSessionTitle"), t("sessionSetup.activeSessionBody"), [
            { text: t("common.continue") },
          ]);
          onStarted(activeSession);
          onActiveSessionConflict?.(sessionId);
          return true;
        }
      } catch {
        // The parent can still refresh active-session state using the known id.
      }
      onActiveSessionConflict?.(sessionId);
      return false;
    },
    [onActiveSessionConflict, onStarted, t],
  );

  const submit = useCallback(async () => {
    const authToken = token?.trim();
    if (!hydrated || !authToken || !selectedType || busy || requestInFlight.current) {
      if (hydrated && !authToken) setError(t("sessionSetup.notSignedIn"));
      return;
    }
    requestInFlight.current = true;
    if (mounted.current) {
      setBusy(true);
      setError(null);
    }
    debugLog("session", "start_attempt", {
      hasNotes: Boolean(notes.trim()),
      moodLevel: mood,
      tagCount: tags.length,
    });
    try {
      const raw = await apiJson<unknown>("/sessions/start", {
        token: authToken,
        method: "POST",
        body: {
          session_type: selectedType,
          notes: notes.trim() ? notes.trim().slice(0, 200) : undefined,
          mood_level: mood ?? undefined,
          tags: tags.length ? tags : undefined,
        },
      });
      const created = tryParseSessionDto(raw);
      if (!created) {
        debugLog("session", "start_invalid_dto", {});
        throw new Error(`Invalid response DTO: ${JSON.stringify(raw)}`);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      debugLog("session", "start_success", { sessionId: created.id });
      if (mounted.current) await Promise.resolve(onStarted(created));
    } catch (submitError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      const message =
        submitError instanceof Error ? submitError.message : t("sessionSetup.startFailed");
      debugLog("session", "start_failure", {
        status: submitError instanceof ApiError ? submitError.status : 0,
        message,
      });
      if (submitError instanceof ApiError && submitError.status === 409) {
        const resumedExistingSession = await resolveConflict(submitError, authToken);
        if (!resumedExistingSession && mounted.current) {
          setError(t("sessionSetup.activeSessionError"));
        }
      } else if (mounted.current) {
        setError(message);
      }
    } finally {
      if (cooldown.current) clearTimeout(cooldown.current);
      cooldown.current = setTimeout(() => {
        requestInFlight.current = false;
      }, SUBMIT_COOLDOWN_MS);
      if (mounted.current) setBusy(false);
    }
  }, [busy, hydrated, mood, notes, onStarted, resolveConflict, selectedType, t, tags, token]);

  return {
    selectedType,
    setSelectedType,
    notes,
    setNotes,
    mood,
    setMood,
    tags,
    removeTag: (tag: string) => setTags((current) => current.filter((item) => item !== tag)),
    tagInput,
    setTagInput,
    tagError,
    suggestedTags: useMemo(() => SUGGESTED_TAGS.filter((tag) => !tags.includes(tag)), [tags]),
    showOptional,
    toggleOptional: () => setShowOptional((current) => !current),
    busy,
    error,
    hydrated,
    addTag,
    submit,
  };
}
