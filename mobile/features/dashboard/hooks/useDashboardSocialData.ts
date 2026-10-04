import { useCallback, useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";

import { apiJson } from "../../../lib/client";
import {
  fetchBuddyRisk,
  fetchChallenges,
  fetchCheckinStatus,
  fetchCommitment,
  fetchIdentityState,
} from "../../../lib/social";
import type {
  BuddyRiskDto,
  CheckinStatusDto,
  CommitmentDto,
  FriendActivityDto,
  FriendLeaderboardDto,
  IdentityStateDto,
  SocialChallengeDto,
} from "../../../types/friends";
import { subscribeChallengeSync } from "../../challenges/sync/challengeSync";
import { useDashboardAuthReset } from "./dashboardAuthReset";

type LoadSocialOptions = { silent?: boolean };

export function useDashboardSocialData(
  token: string | null,
  userId: number | null | undefined,
  t: TFunction,
) {
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [friendActivity, setFriendActivity] = useState<FriendActivityDto[]>([]);
  const [friendLeaderboard, setFriendLeaderboard] = useState<FriendLeaderboardDto | null>(null);
  const [buddyRisk, setBuddyRisk] = useState<BuddyRiskDto | null>(null);
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatusDto | null>(null);
  const [commitmentStatus, setCommitmentStatus] = useState<CommitmentDto | null>(null);
  const [socialChallenges, setSocialChallenges] = useState<SocialChallengeDto[]>([]);
  const [identityState, setIdentityState] = useState<IdentityStateDto | null>(null);
  const loadSequence = useRef(0);

  const resetSocialState = useCallback(() => {
    loadSequence.current += 1;
    setSocialError(null);
    setSocialLoading(false);
    setFriendActivity([]);
    setFriendLeaderboard(null);
    setBuddyRisk(null);
    setCheckinStatus(null);
    setCommitmentStatus(null);
    setSocialChallenges([]);
    setIdentityState(null);
  }, []);

  useDashboardAuthReset(token, userId, resetSocialState);

  const loadSocial = useCallback(
    async ({ silent = false }: LoadSocialOptions = {}) => {
      if (!token) return;
      const sequence = ++loadSequence.current;
      if (!silent) {
        setSocialLoading(true);
        setSocialError(null);
      }
      try {
        const snapshot = await fetchSocialSnapshot(token);
        if (sequence !== loadSequence.current) return;
        setFriendLeaderboard(snapshot.friendLeaderboard);
        setFriendActivity(snapshot.friendActivity);
        applyIfLoaded(snapshot.buddyRisk, setBuddyRisk);
        applyIfLoaded(snapshot.checkinStatus, setCheckinStatus);
        applyIfLoaded(snapshot.commitmentStatus, setCommitmentStatus);
        applyIfLoaded(snapshot.socialChallenges, setSocialChallenges);
        applyIfLoaded(snapshot.identityState, setIdentityState);
      } catch {
        if (sequence !== loadSequence.current || silent) return;
        setSocialError(t("dashboard.socialLoadFailed"));
      } finally {
        if (sequence === loadSequence.current) {
          setSocialLoading(false);
        }
      }
    },
    [token, t],
  );

  useEffect(() => subscribeChallengeSync(() => void loadSocial({ silent: true })), [loadSocial]);

  return {
    socialError,
    setSocialError,
    socialLoading,
    friendActivity,
    friendLeaderboard,
    buddyRisk,
    checkinStatus,
    commitmentStatus,
    socialChallenges,
    identityState,
    loadSocial,
  };
}

function applyIfLoaded<T>(value: T | undefined, setter: (next: T) => void) {
  if (value !== undefined) setter(value);
}

/** Optional parts resolve to `undefined` on failure so the dashboard keeps its last good value. */
function unlessFailed<T>(request: Promise<T>): Promise<T | undefined> {
  return request.catch(() => undefined);
}

async function fetchSocialSnapshot(token: string) {
  const [
    leaderboard,
    activity,
    buddyRisk,
    checkinStatus,
    commitmentStatus,
    challenges,
    identityState,
  ] = await Promise.all([
    apiJson<unknown>("/friends/leaderboard?period=week", { token }),
    apiJson<unknown>("/friends/activity?limit=8", { token }),
    unlessFailed(fetchBuddyRisk(token)),
    unlessFailed(fetchCheckinStatus(token)),
    unlessFailed(fetchCommitment(token)),
    unlessFailed(fetchChallenges(token)),
    unlessFailed(fetchIdentityState(token)),
  ]);

  return {
    friendLeaderboard: parseFriendLeaderboard(leaderboard),
    friendActivity: Array.isArray(activity) ? (activity as FriendActivityDto[]) : [],
    buddyRisk,
    checkinStatus,
    commitmentStatus,
    socialChallenges: challenges === undefined || Array.isArray(challenges) ? challenges : [],
    identityState,
  };
}

function parseFriendLeaderboard(value: unknown): FriendLeaderboardDto | null {
  return value && typeof value === "object" && "entries" in value
    ? (value as FriendLeaderboardDto)
    : null;
}
