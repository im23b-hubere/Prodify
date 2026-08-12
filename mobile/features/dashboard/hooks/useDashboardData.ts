import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { syncWeeklyRecapReminder } from "../../../lib/weeklyRecapNotifications";
import { useDashboardSessionsData } from "./useDashboardSessionsData";
import { useDashboardSocialData } from "./useDashboardSocialData";
import { useDashboardStreakData } from "./useDashboardStreakData";
import { useDashboardWeeklyGoalData } from "./useDashboardWeeklyGoalData";

const DASHBOARD_STALE_MS = 30_000;

export function useDashboardData(token: string | null) {
  const { t } = useTranslation();
  const sessions = useDashboardSessionsData(token, t);
  const social = useDashboardSocialData(token, t);
  const streak = useDashboardStreakData(token);
  const weeklyGoal = useDashboardWeeklyGoalData(token);
  const { loadSessions, setError } = sessions;
  const { loadSocial } = social;
  const { loadStreakOverview } = streak;
  const { loadWeeklyGoal } = weeklyGoal;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastDashboardFetch = useRef(0);

  const refreshDashboard = useCallback(
    async ({
      force = false,
      withLoading = false,
    }: { force?: boolean; withLoading?: boolean } = {}) => {
      if (!token || (!force && isDashboardFresh(lastDashboardFetch.current))) return;
      if (withLoading) setLoading(true);

      try {
        await Promise.all([loadSessions(), loadStreakOverview(), loadWeeklyGoal()]);
        await syncWeeklyRecapReminder(true);
        lastDashboardFetch.current = Date.now();
        if (withLoading) setLoading(false);
        void loadSocial().then(() => {
          lastDashboardFetch.current = Date.now();
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : t("dashboard.loadFailed"));
        if (withLoading) setLoading(false);
      }
    },
    [loadSessions, setError, loadSocial, loadStreakOverview, t, token, loadWeeklyGoal],
  );

  useEffect(() => {
    refreshDashboard({ force: true, withLoading: true }).catch(() => null);
  }, [refreshDashboard]);

  return {
    ...sessions,
    ...social,
    ...streak,
    ...weeklyGoal,
    loading,
    setLoading,
    refreshing,
    setRefreshing,
    refreshDashboard,
  };
}

function isDashboardFresh(lastFetchMs: number): boolean {
  return Date.now() - lastFetchMs < DASHBOARD_STALE_MS;
}
