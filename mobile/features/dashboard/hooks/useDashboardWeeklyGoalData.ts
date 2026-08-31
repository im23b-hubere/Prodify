import { useCallback, useRef, useState } from "react";

import { fetchCurrentGoal } from "../../../lib/goals";
import { useDashboardAuthReset } from "./dashboardAuthReset";

export function useDashboardWeeklyGoalData(
  token: string | null,
  userId: number | null | undefined,
) {
  const [weeklyGoalTarget, setWeeklyGoalTarget] = useState<number | null>(null);
  const [weekSessionsCount, setWeekSessionsCount] = useState(0);
  const loadSequence = useRef(0);

  const resetWeeklyGoalState = useCallback(() => {
    loadSequence.current += 1;
    setWeeklyGoalTarget(null);
    setWeekSessionsCount(0);
  }, []);

  useDashboardAuthReset(token, userId, resetWeeklyGoalState);

  const loadWeeklyGoal = useCallback(async () => {
    if (!token) return;
    const sequence = ++loadSequence.current;
    try {
      const goal = await fetchCurrentGoal(token);
      if (sequence !== loadSequence.current) return;
      setWeeklyGoalTarget(goal?.target_value ?? null);
      setWeekSessionsCount(goal?.current_sessions ?? 0);
    } catch {
      if (sequence !== loadSequence.current) return;
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
