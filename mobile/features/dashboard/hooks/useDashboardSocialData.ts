import { useCallback, useRef, useState } from "react";
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
import { useDashboardAuthReset } from "./dashboardAuthReset";

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

  const loadSocial = useCallback(async () => {
    if (!token) return;
    const sequence = ++loadSequence.current;
    setSocialLoading(true);
    setSocialError(null);
    try {
      const snapshot = await fetchSocialSnapshot(token);
      if (sequence !== loadSequence.current) return;
      setFriendLeaderboard(snapshot.friendLeaderboard);
      setFriendActivity(snapshot.friendActivity);
      setBuddyRisk(snapshot.buddyRisk);
      setCheckinStatus(snapshot.checkinStatus);
      setCommitmentStatus(snapshot.commitmentStatus);
      setSocialChallenges(snapshot.socialChallenges);
      setIdentityState(snapshot.identityState);
    } catch {
      if (sequence !== loadSequence.current) return;
      setSocialError(t("dashboard.socialLoadFailed"));
    } finally {
      if (sequence === loadSequence.current) {
        setSocialLoading(false);
      }
    }
  }, [token, t]);

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
    fetchBuddyRisk(token).catch(() => null),
    fetchCheckinStatus(token).catch(() => null),
    fetchCommitment(token).catch(() => null),
    fetchChallenges(token).catch(() => []),
    fetchIdentityState(token).catch(() => null),
  ]);

  return {
    friendLeaderboard: parseFriendLeaderboard(leaderboard),
    friendActivity: Array.isArray(activity) ? (activity as FriendActivityDto[]) : [],
    buddyRisk,
    checkinStatus,
    commitmentStatus,
    socialChallenges: Array.isArray(challenges) ? challenges : [],
    identityState,
  };
}

function parseFriendLeaderboard(value: unknown): FriendLeaderboardDto | null {
  return value && typeof value === "object" && "entries" in value
    ? (value as FriendLeaderboardDto)
    : null;
}
