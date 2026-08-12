import { useCallback, useEffect, useState } from "react";
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
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token || userId == null) {
        setLoadState("error");
        setError(t("friendProfile.invalidProfile"));
        setRefreshing(false);
        return;
      }
      if (!options?.silent) setLoadState("loading");
      setError(null);
      try {
        const [friendStatus, overview, buddy, recap] = await Promise.all([
          apiJson<FriendStatusPayload>(`/friends/status/${userId}`, { token }),
          apiJson<StreakOverviewDto>("/streak/overview", { token }).catch(() => null),
          fetchBuddyStatus(token).catch(() => null),
          fetchWeeklyRecap(token).catch(() => null),
        ]);
        setStatus(friendStatus.status);
        setTargetUsername(friendStatus.username ?? null);
        setPendingDirection(friendStatus.pending_direction ?? null);
        setYourStreak(overview?.current_streak ?? 0);
        setBuddyStatus(buddy);
        setSocialRecap(recap);

        if (friendStatus.status !== "self" && friendStatus.status !== "accepted") {
          setProfile(null);
          setStats(null);
          setSessions([]);
          setLoadState("ready");
          return;
        }
        const [loadedProfile, loadedStats, loadedSessions] = await Promise.all([
          apiJson<FriendProfilePayload>(`/users/${userId}/profile`, { token }),
          apiJson<FriendStatsPayload>(`/users/${userId}/stats`, { token }),
          apiJson<FriendSessionItem[]>(`/users/${userId}/sessions?limit=10`, { token }),
        ]);
        setProfile(loadedProfile);
        setStats(loadedStats);
        setSessions(Array.isArray(loadedSessions) ? loadedSessions : []);
        setLoadState("ready");
      } catch (loadError) {
        setLoadState("error");
        setError(loadError instanceof Error ? loadError.message : t("friendProfile.loadError"));
      } finally {
        setRefreshing(false);
      }
    },
    [t, token, userId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true });
  }, [load]);

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
