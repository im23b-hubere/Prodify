import { useMemo } from "react";

import type { FriendsDashboardWriter } from "./friendsDashboardState";
import type { FriendsScreenState } from "./useFriendsScreenState";

export function useFriendsDashboardWriter(state: FriendsScreenState): FriendsDashboardWriter {
  const {
    setLeaderboard,
    setActivity,
    setIncoming,
    setBuddy,
    setCheckin,
    setChallenges,
    setDuelRecords,
    setCommitment,
    setRecap,
    setFeedMetricsBySession,
  } = state;
  return useMemo(
    () => ({
      setLeaderboard,
      setActivity,
      setIncoming,
      setBuddy,
      setCheckin,
      setChallenges,
      setDuelRecords,
      setCommitment,
      setRecap,
      setFeedMetricsBySession,
    }),
    [
      setActivity,
      setBuddy,
      setChallenges,
      setCheckin,
      setCommitment,
      setDuelRecords,
      setFeedMetricsBySession,
      setIncoming,
      setLeaderboard,
      setRecap,
    ],
  );
}
