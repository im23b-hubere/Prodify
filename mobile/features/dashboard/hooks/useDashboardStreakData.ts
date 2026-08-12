import { useCallback, useRef, useState } from "react";

import { apiJson } from "../../../lib/client";
import { syncStreakRiskNotifications } from "../../../lib/streakNotifications";
import type { StreakOverviewDto } from "../../../types/streak";

export function useDashboardStreakData(token: string | null) {
  const [streakOverview, setStreakOverview] = useState<StreakOverviewDto | null>(null);
  const loadSequence = useRef(0);

  const loadStreakOverview = useCallback(async () => {
    if (!token) return;
    const sequence = ++loadSequence.current;
    try {
      const overview = await apiJson<StreakOverviewDto>("/streak/overview", { token });
      if (sequence !== loadSequence.current) return;
      setStreakOverview(overview);
      await syncStreakRiskNotifications(overview.streak_at_risk, overview.current_streak);
    } catch {
      if (sequence !== loadSequence.current) return;
      setStreakOverview(null);
    }
  }, [token]);

  return { streakOverview, loadStreakOverview };
}
