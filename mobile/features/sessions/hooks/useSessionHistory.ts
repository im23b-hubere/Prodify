import { useCallback, useRef, useState } from "react";
import type { TFunction } from "i18next";

import { apiJson } from "../../../lib/client";
import { parseSessionList } from "../../../lib/sessionDto";
import type { SessionDto } from "../../../types/session";

export const SESSION_HISTORY_PAGE_SIZE = 50;

export function useSessionHistory(token: string | null | undefined, t: TFunction) {
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  const load = useCallback(
    async (options?: { reset?: boolean }) => {
      const reset = options?.reset ?? true;
      if (!token) {
        setSessions([]);
        setError(t("sessionHistory.notSignedIn"));
        setLoading(false);
        setLoadingMore(false);
        setHasMore(false);
        offsetRef.current = 0;
        return;
      }

      setError(null);
      const requestOffset = reset ? 0 : offsetRef.current;

      try {
        const raw = await apiJson<unknown>(
          `/sessions/list?limit=${SESSION_HISTORY_PAGE_SIZE}&offset=${requestOffset}`,
          { token },
        );
        const parsed = parseSessionList(raw);
        setSessions((prev) => {
          if (reset) return parsed;
          const seen = new Set(prev.map((session) => session.id));
          const next = parsed.filter((session) => !seen.has(session.id));
          return next.length > 0 ? [...prev, ...next] : prev;
        });
        setHasMore(parsed.length >= SESSION_HISTORY_PAGE_SIZE);
        offsetRef.current = requestOffset + parsed.length;
      } catch (e) {
        setError(e instanceof Error ? e.message : t("sessionHistory.loadFailed"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [t, token],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load({ reset: true });
    setRefreshing(false);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    await load({ reset: false });
  }, [hasMore, load, loading, loadingMore]);

  const removeSession = useCallback((sessionId: number) => {
    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
  }, []);

  return {
    sessions,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    load,
    refresh,
    loadMore,
    removeSession,
    setError,
  };
}
