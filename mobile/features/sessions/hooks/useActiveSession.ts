import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { useAuth } from "../../../context/AuthContext";
import { apiJson } from "../../../lib/client";
import { parseSessionList, sessionTagsList, tryParseSessionDto } from "../../../lib/sessionDto";
import {
  effectiveElapsedSeconds,
  formatDurationWords,
  mergeSessionPauseTiming,
  parseSessionDate,
} from "../../../lib/sessionTime";
import type { SessionDto, SessionType } from "../../../types/session";

export const ACTIVE_NOTES_MAX_LENGTH = 2000;
const LONG_SESSION_WARNING_SECONDS = 8 * 3600;

export function useActiveSession(id: string | undefined) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<SessionDto | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [longestCompletedSeconds, setLongestCompletedSeconds] = useState<number | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const longSessionWarned = useRef(false);
  const stopInFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!token) {
      setSession(null);
      setError(t("sessionSetup.notSignedIn"));
      setLoading(false);
      return;
    }

    let sessionId: number | null = null;
    if (id) {
      const parsedId = Number(id);
      if (Number.isFinite(parsedId) && parsedId > 0) sessionId = parsedId;
    } else {
      try {
        const active = await apiJson<unknown>("/sessions/active", { token });
        const candidate =
          active && typeof active === "object" && !Array.isArray(active)
            ? (active as { id?: unknown }).id
            : null;
        sessionId =
          typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0
            ? candidate
            : null;
      } catch {
        sessionId = null;
      }
    }
    if (sessionId == null) {
      setSession(null);
      setError(t("sessionActive.invalidSession"));
      setLoading(false);
      return;
    }

    try {
      const loaded = tryParseSessionDto(
        await apiJson<unknown>(`/sessions/item/${sessionId}`, { token }),
      );
      if (!loaded) {
        setError(t("sessionActive.invalidData"));
        setSession(null);
      } else if (loaded.stopped_at != null) {
        router.replace(`/session/${loaded.id}`);
      } else {
        setSession(loaded);
        setDraftNotes(loaded.notes ?? "");
        setError(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("sessionActive.loadFailed"));
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [id, router, t, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    apiJson<unknown>("/sessions/list?limit=200", { token })
      .then((raw) => {
        const longest = parseSessionList(raw)
          .filter((item) => item.stopped_at && (item.duration_seconds ?? 0) > 0)
          .reduce((maximum, item) => Math.max(maximum, item.duration_seconds ?? 0), 0);
        setLongestCompletedSeconds(longest > 0 ? longest : null);
      })
      .catch(() => setLongestCompletedSeconds(null));
  }, [token]);

  useEffect(() => {
    if (session?.pause_started_at) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.pause_started_at]);

  const elapsed = session ? effectiveElapsedSeconds(session, nowMs) : 0;
  useEffect(() => {
    if (elapsed < LONG_SESSION_WARNING_SECONDS || longSessionWarned.current) return;
    longSessionWarned.current = true;
    Alert.alert(t("sessionActive.longSessionTitle"), t("sessionActive.longSessionBody"));
  }, [elapsed, t]);

  const pause = useCallback(async () => {
    if (!token || !session || session.pause_started_at) return;
    const previous = session;
    const pausedAtMs = Date.now();
    const clientPauseStartedAt = new Date(pausedAtMs).toISOString();
    setNowMs(pausedAtMs);
    setSession({ ...session, pause_started_at: clientPauseStartedAt });
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const updated = tryParseSessionDto(
        await apiJson<unknown>(`/sessions/item/${session.id}/pause`, { token, method: "POST" }),
      );
      if (updated) setSession(mergeSessionPauseTiming(clientPauseStartedAt, updated));
      else {
        setSession(previous);
        setError(t("sessionDetail.invalidResponse"));
      }
    } catch (pauseError) {
      setSession(previous);
      setError(pauseError instanceof Error ? pauseError.message : t("sessionActive.pauseFailed"));
    } finally {
      setBusy(false);
    }
  }, [session, t, token]);

  const resume = useCallback(async () => {
    if (!token || !session?.pause_started_at) return;
    const previous = session;
    const resumedAtMs = Date.now();
    const pauseStartMs = parseSessionDate(session.pause_started_at).getTime();
    const additionalPaused = Number.isFinite(pauseStartMs)
      ? Math.max(0, Math.floor((resumedAtMs - pauseStartMs) / 1000))
      : 0;
    setNowMs(resumedAtMs);
    setSession({
      ...session,
      pause_started_at: null,
      paused_duration_seconds: (session.paused_duration_seconds ?? 0) + additionalPaused,
    });
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const updated = tryParseSessionDto(
        await apiJson<unknown>(`/sessions/item/${session.id}/resume`, { token, method: "POST" }),
      );
      if (updated) setSession(updated);
      else {
        setSession(previous);
        setError(t("sessionDetail.invalidResponse"));
      }
    } catch (resumeError) {
      setSession(previous);
      setError(
        resumeError instanceof Error ? resumeError.message : t("sessionActive.resumeFailed"),
      );
    } finally {
      setBusy(false);
    }
  }, [session, t, token]);

  const saveNotes = useCallback(async () => {
    if (!token || !session) return;
    const notes = draftNotes.trim().slice(0, ACTIVE_NOTES_MAX_LENGTH);
    if (notes === (session.notes ?? "").trim()) return;
    setSavingNotes(true);
    try {
      const updated = tryParseSessionDto(
        await apiJson<unknown>(`/sessions/item/${session.id}`, {
          token,
          method: "PATCH",
          body: { notes: notes || null },
        }),
      );
      if (updated) setSession(updated);
      else setError(t("sessionDetail.invalidResponse"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("sessionActive.saveNotesFailed"));
    } finally {
      setSavingNotes(false);
    }
  }, [draftNotes, session, t, token]);

  const setSessionType = useCallback(
    async (sessionType: SessionType) => {
      if (!token || !session || session.session_type === sessionType) return;
      setBusy(true);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        const updated = tryParseSessionDto(
          await apiJson<unknown>(`/sessions/item/${session.id}`, {
            token,
            method: "PATCH",
            body: { session_type: sessionType },
          }),
        );
        if (updated) setSession(updated);
        else setError(t("sessionDetail.invalidResponse"));
      } catch (updateError) {
        setError(
          updateError instanceof Error ? updateError.message : t("sessionActive.updateFailed"),
        );
      } finally {
        setBusy(false);
      }
    },
    [session, t, token],
  );

  const confirmStop = useCallback(() => {
    if (!session || stopInFlight.current) return;
    const sessionId = session.id;
    Alert.alert(
      t("dashboard.endSessionTitle"),
      t("dashboard.endSessionWorked", { duration: formatDurationWords(elapsed) }),
      [
        { text: t("dashboard.keepGoing"), style: "cancel" },
        {
          text: t("dashboard.endSessionConfirm"),
          style: "destructive",
          onPress: async () => {
            if (!token || stopInFlight.current) return;
            stopInFlight.current = true;
            setBusy(true);
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                () => undefined,
              );
              await apiJson<SessionDto>("/sessions/stop", {
                token,
                method: "POST",
                body: { session_id: sessionId },
              });
              router.replace({ pathname: "/session/complete", params: { id: String(sessionId) } });
            } catch (stopError) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
                () => undefined,
              );
              setError(
                stopError instanceof Error ? stopError.message : t("sessionActive.stopFailed"),
              );
              void load();
            } finally {
              stopInFlight.current = false;
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [elapsed, load, router, session, t, token]);

  const insightLine = useMemo(() => {
    if (longestCompletedSeconds == null) return t("sessionActive.insightDefault");
    return elapsed > longestCompletedSeconds
      ? t("sessionActive.insightPastBest", {
          prev: formatDurationWords(longestCompletedSeconds),
        })
      : t("sessionActive.insightLongest", {
          duration: formatDurationWords(longestCompletedSeconds),
        });
  }, [elapsed, longestCompletedSeconds, t]);

  return {
    session,
    loading,
    error,
    busy,
    elapsed,
    isPaused: Boolean(session?.pause_started_at),
    draftNotes,
    setDraftNotes,
    savingNotes,
    tagList: sessionTagsList(session?.tags),
    insightLine,
    load,
    pause,
    resume,
    saveNotes,
    setSessionType,
    confirmStop,
  };
}
