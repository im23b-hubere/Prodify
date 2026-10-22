import { useCallback, useRef, useState } from "react";

import { apiJson } from "../../../lib/client";
import { syncStreakRiskNotifications } from "../../../lib/streakNotifications";
import type { StreakOverviewDto } from "../../../types/streak";
import { useDashboardAuthReset } from "./dashboardAuthReset";

export function useDashboardStreakData(
  token: string | null,
  userId: number | null | undefined,
) {
  const [streakOverview, setStreakOverview] = useState<StreakOverviewDto | null>(null);
  const [streakOverviewStale, setStreakOverviewStale] = useState(false);
  const loadSequence = useRef(0);

  const resetStreakState = useCallback(() => {
    loadSequence.current += 1;
    setStreakOverview(null);
    setStreakOverviewStale(false);
  }, []);

  useDashboardAuthReset(token, userId, resetStreakState);

  const loadStreakOverview = useCallback(async () => {
    if (!token) return;
    const sequence = ++loadSequence.current;
    try {
      const overview = await apiJson<StreakOverviewDto>("/streak/overview", { token });
      if (sequence !== loadSequence.current) return;
      setStreakOverview(overview);
      setStreakOverviewStale(false);
      await syncLoadedStreak(overview);
    } catch {
      if (sequence !== loadSequence.current) return;
      setStreakOverviewStale(true);
    }
  }, [token]);

  return { streakOverview, streakOverviewStale, loadStreakOverview };
}

async function syncLoadedStreak(overview: StreakOverviewDto) {
  try {
    await syncStreakRiskNotifications(overview.streak_at_risk, overview.current_streak);
  } catch {
    // A reminder failure does not make the overview itself stale.
  }
}
