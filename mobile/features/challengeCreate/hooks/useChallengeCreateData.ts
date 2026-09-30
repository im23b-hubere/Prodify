import { useCallback, useEffect, useMemo, useState } from "react";

import { apiJson } from "../../../lib/client";
import { fetchChallenges } from "../../../lib/social";
import type { FriendLeaderboardDto, SocialChallengeDto } from "../../../types/friends";
import { challengeFriendOptions } from "../challengeFriends";

type LoadState = "loading" | "ready" | "error";

type ChallengeSetupData = {
  leaderboard: FriendLeaderboardDto;
  challenges: SocialChallengeDto[];
};

async function fetchChallengeSetupData(token: string): Promise<ChallengeSetupData> {
  const [leaderboard, challenges] = await Promise.all([
    apiJson<FriendLeaderboardDto>("/friends/leaderboard?period=week", { token }),
    fetchChallenges(token),
  ]);
  return { leaderboard, challenges };
}

export function useChallengeCreateData(token: string | null, userId: number | undefined) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [setupData, setSetupData] = useState<ChallengeSetupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchChallengeSetupData(token).then(
      (data) => {
        if (cancelled) return;
        setSetupData(data);
        setLoadState("ready");
      },
      (caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : null);
        setLoadState("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const retry = useCallback(() => {
    setLoadState("loading");
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  const challenges = useMemo(() => setupData?.challenges ?? [], [setupData]);
  const friends = useMemo(
    () => challengeFriendOptions(setupData?.leaderboard.entries ?? [], challenges, userId),
    [challenges, setupData, userId],
  );

  return { loadState, error, friends, challenges, retry };
}
