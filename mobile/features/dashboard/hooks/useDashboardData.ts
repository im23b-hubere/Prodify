import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiJson } from "../../../lib/client";
import { fetchEntitlement } from "../../../lib/billing";
import {
  fetchBuddyRisk,
  fetchChallenges,
  fetchCheckinStatus,
  fetchCommitment,
  fetchIdentityState,
} from "../../../lib/social";
import { tryParseGoalForecastDto, tryParseProgressionDto } from "../../../lib/outcomesDto";
import { parseMotivationalMessage, type MotivationalMessageDto } from "../../../lib/motivationApi";
import { parseSessionList, tryParseSessionDto } from "../../../lib/sessionDto";
import { syncStreakRiskNotifications } from "../../../lib/streakNotifications";
import type {
  BuddyRiskDto,
  CheckinStatusDto,
  CommitmentDto,
  FriendActivityDto,
  FriendLeaderboardDto,
  IdentityStateDto,
  SocialChallengeDto,
} from "../../../types/friends";
import type { EntitlementDto, GoalForecastDto, ProgressionDto } from "../../../types/outcomes";
import type { SessionDto } from "../../../types/session";
import type { StreakOverviewDto } from "../../../types/streak";

const DASHBOARD_STALE_MS = 30_000;

export function useDashboardData(token: string | null) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [active, setActive] = useState<SessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [streakOverview, setStreakOverview] = useState<StreakOverviewDto | null>(null);
  const [friendActivity, setFriendActivity] = useState<FriendActivityDto[]>([]);
  const [friendLeaderboard, setFriendLeaderboard] = useState<FriendLeaderboardDto | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [buddyRisk, setBuddyRisk] = useState<BuddyRiskDto | null>(null);
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatusDto | null>(null);
  const [commitmentStatus, setCommitmentStatus] = useState<CommitmentDto | null>(null);
  const [socialChallenges, setSocialChallenges] = useState<SocialChallengeDto[]>([]);
  const [identityState, setIdentityState] = useState<IdentityStateDto | null>(null);
  const [weeklyGoalTarget, setWeeklyGoalTarget] = useState<number | null>(null);
  const [weekSessionsCount, setWeekSessionsCount] = useState(0);
  const [serverMotivationDto, setServerMotivationDto] = useState<MotivationalMessageDto | null>(
    null,
  );
  const [forecast, setForecast] = useState<GoalForecastDto | null>(null);
  const [progression, setProgression] = useState<ProgressionDto | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementDto | null>(null);

  const loadSessionsSeq = useRef(0);
  const loadStreakSeq = useRef(0);
  const lastDashboardFetchRef = useRef(0);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    const seq = ++loadSessionsSeq.current;
    try {
      const listRaw = await apiJson<unknown>("/sessions/list", { token });
      if (seq !== loadSessionsSeq.current) return;
      const list = parseSessionList(listRaw);
      setSessions(list);
      let running = list.find((item) => item.stopped_at === null) ?? null;
      if (!running) {
        try {
          const activeRaw = await apiJson<unknown>("/sessions/active", { token });
          running = tryParseSessionDto(activeRaw);
        } catch {
          running = null;
        }
        if (seq !== loadSessionsSeq.current) return;
      }
      setActive(running);
      setLastUpdated(new Date());
    } catch (e) {
      if (seq !== loadSessionsSeq.current) return;
      setError(e instanceof Error ? e.message : t("dashboard.loadSessionsFailed"));
    }
  }, [token, t]);

  const loadSocial = useCallback(async () => {
    if (!token) return;
    setSocialLoading(true);
    try {
      const [
        lbRaw,
        actRaw,
        goalRaw,
        buddyRiskRaw,
        checkinRaw,
        commitmentRaw,
        challengesRaw,
        identityRaw,
      ] = await Promise.all([
        apiJson<unknown>("/friends/leaderboard?period=week", { token }),
        apiJson<unknown>("/friends/activity?limit=8", { token }),
        apiJson<unknown>("/goals/current", { token }),
        fetchBuddyRisk(token).catch(() => null),
        fetchCheckinStatus(token).catch(() => null),
        fetchCommitment(token).catch(() => null),
        fetchChallenges(token).catch(() => []),
        fetchIdentityState(token).catch(() => null),
      ]);
      const lb =
        lbRaw && typeof lbRaw === "object" && "entries" in lbRaw
          ? (lbRaw as FriendLeaderboardDto)
          : null;
      setFriendLeaderboard(lb);
      setFriendActivity(Array.isArray(actRaw) ? (actRaw as FriendActivityDto[]) : []);
      if (goalRaw && typeof goalRaw === "object") {
        const g = goalRaw as { target_value?: unknown; current_sessions?: unknown };
        const tv = typeof g.target_value === "number" ? g.target_value : null;
        const cs = typeof g.current_sessions === "number" ? g.current_sessions : 0;
        setWeeklyGoalTarget(tv);
        setWeekSessionsCount(cs);
      } else {
        setWeeklyGoalTarget(null);
        setWeekSessionsCount(0);
      }
      setBuddyRisk(buddyRiskRaw);
      setCheckinStatus(checkinRaw);
      setCommitmentStatus(commitmentRaw);
      setSocialChallenges(Array.isArray(challengesRaw) ? challengesRaw : []);
      setIdentityState(identityRaw);
      const [forecastRaw, progRaw] = await Promise.all([
        apiJson<unknown>("/outcomes/goal-forecast/current", { token }).catch(() => null),
        apiJson<unknown>("/progression/me", { token }).catch(() => null),
      ]);
      setForecast(forecastRaw ? tryParseGoalForecastDto(forecastRaw) : null);
      setProgression(progRaw ? tryParseProgressionDto(progRaw) : null);
      const ent = await fetchEntitlement(token).catch(() => null);
      setEntitlement(ent);
    } catch {
      setFriendLeaderboard(null);
      setFriendActivity([]);
      setForecast(null);
      setBuddyRisk(null);
      setCheckinStatus(null);
      setCommitmentStatus(null);
      setSocialChallenges([]);
      setIdentityState(null);
    } finally {
      setSocialLoading(false);
    }
  }, [token]);

  const loadStreakOverview = useCallback(async () => {
    if (!token) return;
    const seq = ++loadStreakSeq.current;
    try {
      const data = await apiJson<StreakOverviewDto>("/streak/overview", { token });
      if (seq !== loadStreakSeq.current) return;
      setStreakOverview(data);
      await syncStreakRiskNotifications(data.streak_at_risk, data.current_streak);
    } catch {
      if (seq !== loadStreakSeq.current) return;
      setStreakOverview(null);
    }
  }, [token]);

  const loadServerMotivation = useCallback(async () => {
    if (!token) {
      setServerMotivationDto(null);
      return;
    }
    try {
      const raw = await apiJson<unknown>("/motivational-messages/random", { token });
      const parsed = parseMotivationalMessage(raw);
      setServerMotivationDto(parsed);
    } catch {
      setServerMotivationDto(null);
    }
  }, [token]);

  const refreshDashboard = useCallback(
    async ({
      force = false,
      withLoading = false,
    }: { force?: boolean; withLoading?: boolean } = {}) => {
      if (!token) return;
      const now = Date.now();
      const hasFreshData = now - lastDashboardFetchRef.current < DASHBOARD_STALE_MS;
      if (!force && hasFreshData) {
        return;
      }
      if (withLoading) {
        setLoading(true);
      }
      try {
        await Promise.all([
          loadSessions(),
          loadStreakOverview(),
          loadSocial(),
          loadServerMotivation(),
        ]);
        lastDashboardFetchRef.current = Date.now();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("dashboard.loadFailed"));
      } finally {
        if (withLoading) {
          setLoading(false);
        }
      }
    },
    [token, loadSessions, loadStreakOverview, loadSocial, loadServerMotivation, t],
  );

  useEffect(() => {
    refreshDashboard({ force: true, withLoading: true }).catch(() => null);
  }, [refreshDashboard]);

  return {
    sessions,
    setSessions,
    active,
    setActive,
    loading,
    setLoading,
    error,
    setError,
    refreshing,
    setRefreshing,
    lastUpdated,
    streakOverview,
    friendActivity,
    friendLeaderboard,
    socialLoading,
    buddyRisk,
    checkinStatus,
    commitmentStatus,
    socialChallenges,
    identityState,
    weeklyGoalTarget,
    weekSessionsCount,
    serverMotivationDto,
    forecast,
    progression,
    entitlement,
    loadSessions,
    loadStreakOverview,
    loadSocial,
    loadServerMotivation,
    refreshDashboard,
  };
}
