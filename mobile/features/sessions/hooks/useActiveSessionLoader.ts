import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { useAuthScopedReset } from "../../../lib/authScopedReset";
import type { SessionDto } from "../../../types/session";
import {
  fetchActiveSession,
  fetchLongestCompletedSessionSeconds,
  resolveActiveSessionId,
} from "../services/activeSessionApi";

export function useActiveSessionLoader(
  token: string | null,
  userId: number | null | undefined,
  requestedId: string | undefined,
) {
  const { t } = useTranslation();
  const router = useRouter();
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const [session, setSession] = useState<SessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [longestCompletedSeconds, setLongestCompletedSeconds] = useState<number | null>(null);
  const loadSequence = useRef(0);
  const insightSequence = useRef(0);

  const resetActiveSessionState = useCallback(() => {
    loadSequence.current += 1;
    insightSequence.current += 1;
    setSession(null);
    setError(null);
    setLongestCompletedSeconds(null);
    setLoading(Boolean(token && userId != null));
  }, [token, userId]);

  useAuthScopedReset(token, userId, resetActiveSessionState);

  const finishWithError = useCallback((message: string, sequence: number) => {
    if (sequence !== loadSequence.current) return;
    setSession(null);
    setError(message);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    const currentToken = tokenRef.current;
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    if (!currentToken) {
      finishWithError(t("sessionSetup.notSignedIn"), sequence);
      return;
    }

    const sessionId = await resolveActiveSessionId(currentToken, requestedId);
    if (sequence !== loadSequence.current) return;

    if (sessionId == null) {
      finishWithError(t("sessionActive.invalidSession"), sequence);
      return;
    }

    try {
      const loaded = await fetchActiveSession(currentToken, sessionId);
      if (sequence !== loadSequence.current) return;

      if (!loaded) finishWithError(t("sessionActive.invalidData"), sequence);
      else if (loaded.stopped_at != null) router.replace(`/session/${loaded.id}`);
      else {
        setSession(loaded);
        setError(null);
      }
    } catch (loadError) {
      finishWithError(
        loadError instanceof Error ? loadError.message : t("sessionActive.loadFailed"),
        sequence,
      );
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [finishWithError, requestedId, router, t]);

  useEffect(() => {
    if (!tokenRef.current || userId == null) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, userId, requestedId]);

  useEffect(() => {
    if (userId == null || !tokenRef.current) return;

    const sequence = ++insightSequence.current;
    const currentToken = tokenRef.current;

    fetchLongestCompletedSessionSeconds(currentToken)
      .then((value) => {
        if (sequence !== insightSequence.current) return;
        setLongestCompletedSeconds(value);
      })
      .catch(() => {
        if (sequence !== insightSequence.current) return;
        setLongestCompletedSeconds(null);
      });
  }, [userId]);

  return {
    session,
    setSession,
    loading,
    error,
    setError,
    longestCompletedSeconds,
    load,
  };
}
