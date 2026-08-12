import { useFocusEffect } from "expo-router";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { apiJson } from "../../../lib/client";
import { parseSessionList } from "../../../lib/sessionDto";
import type { SessionDto } from "../../../types/session";

const TRASH_PAGE_SIZE = 50;

type SessionTrashMessages = {
  notSignedIn: string;
  loadFailed: string;
  refreshFailed: string;
  loadMoreFailed: string;
  restoreFailed: string;
};

type TrashLifecycleOptions = {
  load: (reset?: boolean) => Promise<void>;
  loadFailed: string;
  refreshFailed: string;
  setError: (message: string | null) => void;
  setLoading: (loading: boolean) => void;
};

function useTrashLifecycle({
  load,
  loadFailed,
  refreshFailed,
  setError,
  setLoading,
}: TrashLifecycleOptions) {
  const skipInitialFocusRef = useRef(true);
  useEffect(() => {
    void load(true).catch((caught) => setError(errorMessage(caught, loadFailed)));
  }, [load, loadFailed, setError]);

  useFocusEffect(
    useCallback(() => {
      if (skipInitialFocusRef.current) {
        skipInitialFocusRef.current = false;
        return;
      }
      void load(true).catch((caught) => setError(errorMessage(caught, refreshFailed)));
    }, [load, refreshFailed, setError]),
  );

  return useCallback(() => {
    setLoading(true);
    void load(true).catch((caught) => setError(errorMessage(caught, loadFailed)));
  }, [load, loadFailed, setError, setLoading]);
}

function useTrashRefresh(
  load: (reset?: boolean) => Promise<void>,
  refreshFailed: string,
  setError: (message: string | null) => void,
) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } catch (caught) {
      setError(errorMessage(caught, refreshFailed));
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshFailed, setError]);
  return { refreshing, refresh };
}

type RestoreOptions = {
  token: string | null;
  sessions: SessionDto[];
  setSessions: Dispatch<SetStateAction<SessionDto[]>>;
  load: (reset?: boolean) => Promise<void>;
  restoreFailed: string;
  setError: (message: string | null) => void;
};

function useRestoreTrashedSession(options: RestoreOptions) {
  const { token, sessions, setSessions, load, restoreFailed, setError } = options;
  const [busyId, setBusyId] = useState<number | null>(null);
  const restore = useCallback(
    async (id: number) => {
      if (!token) return;
      setBusyId(id);
      const previous = sessions;
      setSessions((current) => current.filter((session) => session.id !== id));
      try {
        await apiJson(`/sessions/item/${id}/restore`, { token, method: "POST" });
        await load(true);
      } catch (caught) {
        setSessions(previous);
        setError(errorMessage(caught, restoreFailed));
      } finally {
        setBusyId(null);
      }
    },
    [load, restoreFailed, sessions, setError, setSessions, token],
  );
  return { busyId, restore };
}

export function useSessionTrash(token: string | null, messages: SessionTrashMessages) {
  const { notSignedIn, loadFailed, refreshFailed, loadMoreFailed, restoreFailed } = messages;
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);

  const load = useCallback(
    async (reset = true) => {
      if (!token) {
        setSessions([]);
        setError(notSignedIn);
        setLoading(false);
        setHasMore(false);
        setLoadingMore(false);
        offsetRef.current = 0;
        return;
      }
      setError(null);
      const offset = reset ? 0 : offsetRef.current;
      try {
        const raw = await apiJson<unknown>(
          `/sessions/trash?limit=${TRASH_PAGE_SIZE}&offset=${offset}`,
          { token },
        );
        const page = parseSessionList(raw);
        setSessions((current) => (reset ? page : mergeUniqueSessions(current, page)));
        setHasMore(page.length >= TRASH_PAGE_SIZE);
        offsetRef.current = offset + page.length;
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [notSignedIn, token],
  );

  const retry = useTrashLifecycle({ load, loadFailed, refreshFailed, setError, setLoading });
  const { refreshing, refresh } = useTrashRefresh(load, refreshFailed, setError);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      await load(false);
    } catch (caught) {
      setError(errorMessage(caught, loadMoreFailed));
    }
  }, [hasMore, load, loading, loadingMore, loadMoreFailed]);

  const { busyId, restore } = useRestoreTrashedSession({
    token,
    sessions,
    setSessions,
    load,
    restoreFailed,
    setError,
  });

  return {
    sessions,
    refreshing,
    busyId,
    error,
    loading,
    hasMore,
    loadingMore,
    refresh,
    loadMore,
    restore,
    retry,
  };
}

export function mergeUniqueSessions(current: SessionDto[], page: SessionDto[]): SessionDto[] {
  const existingIds = new Set(current.map((session) => session.id));
  const additions = page.filter((session) => !existingIds.has(session.id));
  return additions.length > 0 ? [...current, ...additions] : current;
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}
