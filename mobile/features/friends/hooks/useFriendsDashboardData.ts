import { useFocusEffect } from "@react-navigation/native";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef } from "react";

import { isScreenDataStale } from "../../../lib/screenDataStale";
import { loadFriendsDashboard } from "../services/friendsDashboardApi";
import {
  resetFriendsAccountOwnedState,
  useFriendsAuthReset,
} from "./friendsAuthReset";
import {
  applyFriendsDashboardSnapshot,
  clearFriendsDashboardSnapshot,
} from "./friendsDashboardState";
import { useFriendsDashboardWriter } from "./useFriendsDashboardWriter";
import type { FriendsScreenState } from "./useFriendsScreenState";

type Params = {
  token: string | null;
  userId: number | null | undefined;
  periodParam: "week" | "all";
  t: TFunction;
  state: FriendsScreenState;
};

function shouldUseCachedDashboard(force: boolean, lastFetch: number) {
  return !force && !isScreenDataStale(lastFetch);
}

function isCurrentRequest(
  mounted: { current: boolean },
  loadSequence: { current: number },
  sequence: number,
) {
  return mounted.current && sequence === loadSequence.current;
}

function dashboardLoadError(error: unknown, t: TFunction) {
  return error instanceof Error ? error.message : t("friendsScreen.loadError");
}

export function useFriendsDashboardData({ token, userId, periodParam, t, state }: Params) {
  const lastFetchRef = useRef(0);
  const dashboardWriter = useFriendsDashboardWriter(state);
  const { loadSeq, mounted, setLoading, setError, setRefreshing } = state;

  const resetFriendsAuthScope = useCallback(() => {
    lastFetchRef.current = 0;
    resetFriendsAccountOwnedState(state, { token, userId });
  }, [state, token, userId]);

  useFriendsAuthReset(token, userId, resetFriendsAuthScope);

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = Boolean(opts?.force);
      if (shouldUseCachedDashboard(force, lastFetchRef.current)) return;

      const seq = ++loadSeq.current;
      if (!token) {
        if (mounted.current) setLoading(false);
        return;
      }
      if (mounted.current) setError(null);
      try {
        const snapshot = await loadFriendsDashboard(token, periodParam);
        if (!isCurrentRequest(mounted, loadSeq, seq)) return;
        applyFriendsDashboardSnapshot(dashboardWriter, snapshot);
        lastFetchRef.current = Date.now();
      } catch (e) {
        if (!isCurrentRequest(mounted, loadSeq, seq)) return;
        setError(dashboardLoadError(e, t));
        clearFriendsDashboardSnapshot(dashboardWriter);
      } finally {
        if (!isCurrentRequest(mounted, loadSeq, seq)) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, periodParam, t, loadSeq, mounted, setLoading, setError, setRefreshing, dashboardWriter],
  );

  const onRefresh = useFriendsDashboardRefresh(load, periodParam, setRefreshing);
  return { load, onRefresh };
}

function useFriendsDashboardRefresh(
  load: (options?: { force?: boolean }) => Promise<void>,
  periodParam: "week" | "all",
  setRefreshing: (refreshing: boolean) => void,
) {
  const lastPeriodParamRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  useEffect(() => {
    if (lastPeriodParamRef.current === null) {
      lastPeriodParamRef.current = periodParam;
      return;
    }
    if (lastPeriodParamRef.current === periodParam) return;
    lastPeriodParamRef.current = periodParam;
    load({ force: true }).catch(() => undefined);
  }, [load, periodParam]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ force: true }).catch(() => undefined);
  }, [load, setRefreshing]);

  return onRefresh;
}
