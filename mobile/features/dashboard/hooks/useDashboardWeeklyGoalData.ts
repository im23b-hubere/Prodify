import { useCallback, useState } from "react";

import { fetchCurrentGoal } from "../../../lib/goals";

export function useDashboardWeeklyGoalData(token: string | null) {
  const [weeklyGoalTarget, setWeeklyGoalTarget] = useState<number | null>(null);
  const [weekSessionsCount, setWeekSessionsCount] = useState(0);

  const loadWeeklyGoal = useCallback(async () => {
    if (!token) return;
    try {
      const goal = await fetchCurrentGoal(token).catch(() => null);
      setWeeklyGoalTarget(goal?.target_value ?? null);
      setWeekSessionsCount(goal?.current_sessions ?? 0);
    } catch {
      // Keep the last known weekly goal snapshot on transient failures.
    }
  }, [token]);

  return {
    weeklyGoalTarget,
    hasWeeklyGoal: weeklyGoalTarget != null && weeklyGoalTarget > 0,
    weekSessionsCount,
    loadWeeklyGoal,
  };
}
