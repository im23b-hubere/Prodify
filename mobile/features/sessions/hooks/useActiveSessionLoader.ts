import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import type { SessionDto } from "../../../types/session";
import {
  fetchActiveSession,
  fetchLongestCompletedSessionSeconds,
  resolveActiveSessionId,
} from "../services/activeSessionApi";

export function useActiveSessionLoader(token: string | null, requestedId: string | undefined) {
  const { t } = useTranslation();
  const router = useRouter();
  const [session, setSession] = useState<SessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [longestCompletedSeconds, setLongestCompletedSeconds] = useState<number | null>(null);

  const finishWithError = useCallback((message: string) => {
    setSession(null);
    setError(message);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!token) {
      finishWithError(t("sessionSetup.notSignedIn"));
      return;
    }

    const sessionId = await resolveActiveSessionId(token, requestedId);
    if (sessionId == null) {
      finishWithError(t("sessionActive.invalidSession"));
      return;
    }

    try {
      const loaded = await fetchActiveSession(token, sessionId);
      if (!loaded) finishWithError(t("sessionActive.invalidData"));
      else if (loaded.stopped_at != null) router.replace(`/session/${loaded.id}`);
      else {
        setSession(loaded);
        setError(null);
      }
    } catch (loadError) {
      finishWithError(
        loadError instanceof Error ? loadError.message : t("sessionActive.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [finishWithError, requestedId, router, t, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    fetchLongestCompletedSessionSeconds(token)
      .then(setLongestCompletedSeconds)
      .catch(() => setLongestCompletedSeconds(null));
  }, [token]);

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
