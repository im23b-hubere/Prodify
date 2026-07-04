import { useFocusEffect } from "@react-navigation/native";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef } from "react";

import { isScreenDataStale } from "../../../lib/screenDataStale";
import { loadFriendsDashboard } from "../services/friendsDashboardApi";
import type { FriendsScreenState } from "./useFriendsScreenState";

type Params = {
  token: string | null;
  periodParam: "week" | "all";
  t: TFunction;
  state: FriendsScreenState;
};

export function useFriendsDashboardData({ token, periodParam, t, state }: Params) {
  const lastFetchRef = useRef(0);
  const lastPeriodParamRef = useRef<string | null>(null);
  const {
    loadSeq,
    mounted,
    setLoading,
    setError,
    setLeaderboard,
    setActivity,
    setIncoming,
    setBuddy,
    setCheckin,
    setChallenges,
    setCommitment,
    setRecap,
    setFeedMetricsBySession,
    setRefreshing,
  } = state;

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = Boolean(opts?.force);
      if (!force && !isScreenDataStale(lastFetchRef.current)) {
        return;
      }

      const seq = ++loadSeq.current;
      if (!token) {
        if (mounted.current) setLoading(false);
        return;
      }
      if (mounted.current) setError(null);
      try {
        const snapshot = await loadFriendsDashboard(token, periodParam);
        if (!mounted.current || seq !== loadSeq.current) return;
        setLeaderboard(snapshot.leaderboard);
        setActivity(snapshot.activity);
        setIncoming(snapshot.incoming);
        setBuddy(snapshot.buddy);
        setCheckin(snapshot.checkin);
        setChallenges(snapshot.challenges);
        setCommitment(snapshot.commitment);
        setRecap(snapshot.recap);
        const metricsSeed: Record<
          number,
          { reactionsCount: number; commentsCount: number; viewerReaction: string | null }
        > = {};
        for (const item of snapshot.activity) {
          metricsSeed[item.session_id] = {
            reactionsCount: item.reactions_count ?? 0,
            commentsCount: item.comments_count ?? 0,
            viewerReaction: item.viewer_reaction ?? null,
          };
        }
        setFeedMetricsBySession(metricsSeed);
        lastFetchRef.current = Date.now();
      } catch (e) {
        if (!mounted.current || seq !== loadSeq.current) return;
        setError(e instanceof Error ? e.message : t("friendsScreen.loadError"));
        setActivity([]);
        setIncoming([]);
        setBuddy(null);
        setCheckin(null);
        setChallenges([]);
        setCommitment(null);
        setRecap(null);
        setFeedMetricsBySession({});
      } finally {
        if (!mounted.current || seq !== loadSeq.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      token,
      periodParam,
      t,
      loadSeq,
      mounted,
      setLoading,
      setError,
      setLeaderboard,
      setActivity,
      setIncoming,
      setBuddy,
      setCheckin,
      setChallenges,
      setCommitment,
      setRecap,
      setFeedMetricsBySession,
      setRefreshing,
    ],
  );

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

  return { load, onRefresh };
}
