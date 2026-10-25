import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { apiJson } from "../../../lib/client";
import { fetchBuddyStatus } from "../../../lib/social";
import { userFacingErrorOrFallback } from "../../../lib/userFacingErrorMessage";
import type { FriendCommitmentDto } from "../../../types/friends";
import { subscribeFriendsSync } from "../../friends/sync/friendsSync";
import type { HeatmapCell } from "../../stats/types";

export type FriendStatus = "self" | "none" | "pending" | "accepted";
export type PendingDirection = "outgoing" | "incoming";

type FriendStatusPayload = {
  status: FriendStatus;
  username?: string | null;
  pending_direction?: PendingDirection | null;
  friendship_id?: number | null;
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
  level?: number;
  xp_total?: number;
  level_progress_percent?: number;
};

export type FriendStatsPayload = {
  total_hours: number;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  type_breakdown: Record<string, number>;
  best_day: string | null;
  heatmap_days: HeatmapCell[];
  achievements: { id: string; unlocked_at: string }[];
};

export type FriendSessionItem = {
  id: number;
  session_type: string;
  duration_seconds: number;
  started_at: string;
  mood_level: number | null;
};

type VisibleProfile = {
  profile: FriendProfilePayload;
  stats: FriendStatsPayload;
  sessions: FriendSessionItem[];
  commitment: FriendCommitmentDto | null;
  /** The viewer's own stats, used for the head-to-head card; null on your own profile. */
  yourStats: FriendStatsPayload | null;
  isBuddy: boolean;
};

type ProfileData = {
  status: FriendStatus;
  targetUsername: string | null;
  pendingDirection: PendingDirection | null;
  friendshipId: number | null;
  visible: VisibleProfile | null;
};

type LoadState = "loading" | "ready" | "error";

async function loadVisibleProfile(
  token: string,
  userId: number,
  viewerId: number | null,
): Promise<VisibleProfile> {
  const isOwnProfile = viewerId === userId;
  const [profile, stats, sessions, commitment, yourStats, buddy] = await Promise.all([
    apiJson<FriendProfilePayload>(`/users/${userId}/profile`, { token }),
    apiJson<FriendStatsPayload>(`/users/${userId}/stats`, { token }),
    apiJson<FriendSessionItem[]>(`/users/${userId}/sessions?limit=10`, { token }),
    apiJson<FriendCommitmentDto | null>(`/users/${userId}/commitment`, { token }).catch(() => null),
    isOwnProfile || viewerId == null
      ? null
      : apiJson<FriendStatsPayload>(`/users/${viewerId}/stats`, { token }).catch(() => null),
    isOwnProfile ? null : fetchBuddyStatus(token).catch(() => null),
  ]);
  return {
    profile,
    stats,
    sessions: Array.isArray(sessions) ? sessions : [],
    commitment,
    yourStats,
    isBuddy: buddy?.buddy_user_id === userId,
  };
}

async function loadProfileData(
  token: string,
  userId: number,
  viewerId: number | null,
): Promise<ProfileData> {
  const friendStatus = await apiJson<FriendStatusPayload>(`/friends/status/${userId}`, { token });
  const canView = friendStatus.status === "self" || friendStatus.status === "accepted";
  return {
    status: friendStatus.status,
    targetUsername: friendStatus.username ?? null,
    pendingDirection: friendStatus.pending_direction ?? null,
    friendshipId: friendStatus.friendship_id ?? null,
    visible: canView ? await loadVisibleProfile(token, userId, viewerId) : null,
  };
}

function loadErrorMessage(error: unknown, fallback: string): string {
  return userFacingErrorOrFallback(error, fallback);
}

function useFriendProfileLifecycle(load: () => Promise<void>) {
  useEffect(() => {
    void load();
  }, [load]);
}

function useFriendProfileSync(load: (options?: { silent?: boolean }) => Promise<void>) {
  useEffect(
    () =>
      subscribeFriendsSync(() => {
        void load({ silent: true });
      }),
    [load],
  );
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
  const viewerId = user?.id ?? null;
  const [data, setData] = useState<ProfileData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
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
        setData(await loadProfileData(target.token, target.userId, viewerId));
        setLoadState("ready");
      } catch (loadError) {
        setLoadState("error");
        setError(loadErrorMessage(loadError, t("friendProfile.loadError")));
      }
    },
    [t, target, viewerId],
  );

  useFriendProfileLifecycle(load);
  useFriendProfileSync(load);
  const { refreshing, refresh } = useFriendProfileRefresh(load);

  return {
    status: data?.status ?? null,
    targetUsername: data?.targetUsername ?? null,
    pendingDirection: data?.pendingDirection ?? null,
    friendshipId: data?.friendshipId ?? null,
    visible: data?.visible ?? null,
    loadState,
    error,
    refreshing,
    isOwnProfile: viewerId != null && viewerId === userId,
    load,
    refresh,
  };
}

export type FriendProfileState = ReturnType<typeof useFriendProfile>;
