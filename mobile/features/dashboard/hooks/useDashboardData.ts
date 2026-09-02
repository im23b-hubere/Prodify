import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { syncWeeklyRecapReminder } from "../../../lib/weeklyRecapNotifications";
import { useDashboardAuthReset } from "./dashboardAuthReset";
import { useDashboardSessionsData } from "./useDashboardSessionsData";
import { useDashboardSocialData } from "./useDashboardSocialData";
import { useDashboardStreakData } from "./useDashboardStreakData";
import { useDashboardWeeklyGoalData } from "./useDashboardWeeklyGoalData";

const DASHBOARD_STALE_MS = 30_000;

export function useDashboardData(token: string | null, userId: number | null | undefined) {
  const { t } = useTranslation();
  const sessions = useDashboardSessionsData(token, userId, t);
  const social = useDashboardSocialData(token, userId, t);
  const streak = useDashboardStreakData(token, userId);
  const weeklyGoal = useDashboardWeeklyGoalData(token, userId);
  const { loadSessions, setError } = sessions;
  const { loadSocial } = social;
  const { loadStreakOverview } = streak;
  const { loadWeeklyGoal } = weeklyGoal;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastDashboardFetch = useRef(0);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const resetDashboardShell = useCallback(() => {
    lastDashboardFetch.current = 0;
    refreshInFlight.current = null;
    setRefreshing(false);
    setLoading(Boolean(token && userId != null));
  }, [token, userId]);

  useDashboardAuthReset(token, userId, resetDashboardShell);

  const invalidateDashboard = useCallback(() => {
    lastDashboardFetch.current = 0;
  }, []);

  const refreshDashboard = useCallback(
    async ({
      force = false,
      withLoading = false,
    }: { force?: boolean; withLoading?: boolean } = {}) => {
      if (!token || userId == null) return;
      if (!force && isDashboardFresh(lastDashboardFetch.current)) return;
      if (refreshInFlight.current) return refreshInFlight.current;

      const run = (async () => {
        if (withLoading) setLoading(true);
        try {
          await Promise.all([loadSessions(), loadStreakOverview(), loadWeeklyGoal()]);
          await syncWeeklyRecapReminder(true);
          lastDashboardFetch.current = Date.now();
          void loadSocial().then(() => {
            lastDashboardFetch.current = Date.now();
          });
        } catch (error) {
          setError(error instanceof Error ? error.message : t("dashboard.loadFailed"));
        } finally {
          if (withLoading) setLoading(false);
        }
      })();

      refreshInFlight.current = run;
      try {
        await run;
      } finally {
        if (refreshInFlight.current === run) refreshInFlight.current = null;
      }
    },
    [loadSessions, setError, loadSocial, loadStreakOverview, t, token, userId, loadWeeklyGoal],
  );

  useEffect(() => {
    if (!token || userId == null) {
      setLoading(false);
      return;
    }
    refreshDashboard({ force: true, withLoading: true }).catch(() => null);
  }, [refreshDashboard, token, userId]);

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
    invalidateDashboard,
  };
}

function isDashboardFresh(lastFetchMs: number): boolean {
  return Date.now() - lastFetchMs < DASHBOARD_STALE_MS;
}
