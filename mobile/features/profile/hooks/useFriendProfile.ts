import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { apiJson } from "../../../lib/client";
import { fetchBuddyStatus, fetchWeeklyRecap } from "../../../lib/social";
import type { BuddyStatusDto, SocialRecapDto } from "../../../types/friends";
import type { StreakOverviewDto } from "../../../types/streak";

export type FriendStatus = "self" | "none" | "pending" | "accepted";

type FriendStatusPayload = {
  status: FriendStatus;
  username?: string | null;
  pending_direction?: "outgoing" | "incoming" | null;
};

export type FriendProfilePayload = {
  id: number;
  username: string;
  profile_picture_url?: string | null;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  friends_count: number;
  is_premium?: boolean;
  identity_tags?: string[];
  created_at: string;
  reliability_score?: number;
  reliability_trend?: "up" | "down" | "stable";
  reliability_rank_percent?: number | null;
  streak_status_key?: string;
  streak_status_label?: string;
  streak_status_emoji?: string;
};

export type FriendStatsPayload = {
  total_hours: number;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  type_breakdown: Record<string, number>;
  best_day: string | null;
  heatmap_days: { date: string; seconds: number; intensity: number }[];
  achievements: { id: string; unlocked_at: string }[];
};

export type FriendSessionItem = {
  id: number;
  session_type: string;
  duration_seconds: number;
  started_at: string;
  mood_level: number | null;
};

async function loadFriendContext(token: string, userId: number) {
  const [friendStatus, overview, buddyStatus, socialRecap] = await Promise.all([
    apiJson<FriendStatusPayload>(`/friends/status/${userId}`, { token }),
    apiJson<StreakOverviewDto>("/streak/overview", { token }).catch(() => null),
    fetchBuddyStatus(token).catch(() => null),
    fetchWeeklyRecap(token).catch(() => null),
  ]);
  return { friendStatus, overview, buddyStatus, socialRecap };
}

async function loadVisibleProfile(token: string, userId: number) {
  const [profile, stats, sessions] = await Promise.all([
    apiJson<FriendProfilePayload>(`/users/${userId}/profile`, { token }),
    apiJson<FriendStatsPayload>(`/users/${userId}/stats`, { token }),
    apiJson<FriendSessionItem[]>(`/users/${userId}/sessions?limit=10`, { token }),
  ]);
  return { profile, stats, sessions: Array.isArray(sessions) ? sessions : [] };
}

function useFriendProfileLifecycle(load: (options?: { silent?: boolean }) => Promise<void>) {
  useEffect(() => {
    void load();
  }, [load]);
}

function canViewProfile(status: FriendStatus): boolean {
  return status === "self" || status === "accepted";
}

function loadErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function useFriendProfileRefresh(load: (options?: { silent?: boolean }) => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true }).finally(() => setRefreshing(false));
  }, [load]);
  return { refreshing, refresh };
}

export function useFriendProfile(userId: number | null) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const [status, setStatus] = useState<FriendStatus | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const [pendingDirection, setPendingDirection] = useState<"outgoing" | "incoming" | null>(null);
  const [profile, setProfile] = useState<FriendProfilePayload | null>(null);
  const [stats, setStats] = useState<FriendStatsPayload | null>(null);
  const [sessions, setSessions] = useState<FriendSessionItem[]>([]);
  const [yourStreak, setYourStreak] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [buddyStatus, setBuddyStatus] = useState<BuddyStatusDto | null>(null);
  const [socialRecap, setSocialRecap] = useState<SocialRecapDto | null>(null);
  const target = useMemo(
    () => (token && userId != null ? { token, userId } : null),
    [token, userId],
  );

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!target) {
        setLoadState("error");
        setError(t("friendProfile.invalidProfile"));
        return;
      }
      if (!options?.silent) setLoadState("loading");
      setError(null);
      try {
        const { friendStatus, overview, buddyStatus, socialRecap } = await loadFriendContext(
          target.token,
          target.userId,
        );
        setStatus(friendStatus.status);
        setTargetUsername(friendStatus.username ?? null);
        setPendingDirection(friendStatus.pending_direction ?? null);
        setYourStreak(overview?.current_streak ?? 0);
        setBuddyStatus(buddyStatus);
        setSocialRecap(socialRecap);

        if (!canViewProfile(friendStatus.status)) {
          setProfile(null);
          setStats(null);
          setSessions([]);
          setLoadState("ready");
          return;
        }
        const visibleProfile = await loadVisibleProfile(target.token, target.userId);
        setProfile(visibleProfile.profile);
        setStats(visibleProfile.stats);
        setSessions(visibleProfile.sessions);
        setLoadState("ready");
      } catch (loadError) {
        setLoadState("error");
        setError(loadErrorMessage(loadError, t("friendProfile.loadError")));
      }
    },
    [t, target],
  );

  useFriendProfileLifecycle(load);
  const { refreshing, refresh } = useFriendProfileRefresh(load);

  return {
    status,
    targetUsername,
    pendingDirection,
    profile,
    stats,
    sessions,
    yourStreak,
    loadState,
    error,
    buddyStatus,
    socialRecap,
    refreshing,
    isOwnProfile: user?.id != null && user.id === userId,
    load,
    refresh,
  };
}

export type FriendProfileState = ReturnType<typeof useFriendProfile>;
