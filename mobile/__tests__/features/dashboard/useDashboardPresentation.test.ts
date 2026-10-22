import { renderHook } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { useDashboardPresentation } from "../../../features/dashboard/hooks/useDashboardPresentation";
import type { SessionDto } from "../../../types/session";
import type { StreakOverviewDto } from "../../../types/streak";

const t = ((key: string) => key) as TFunction;

const sessionToday: SessionDto = {
  id: 1,
  user_id: 1,
  started_at: new Date().toISOString(),
  stopped_at: new Date().toISOString(),
  duration_seconds: 600,
  session_type: "beat_making",
  notes: null,
};

const serverOverview: StreakOverviewDto = {
  current_streak: 12,
  longest_streak: 20,
  last_7_day_states: ["freeze", "session", "session", "session", "session", "session", "none"],
  last_7_day_labels: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  freezes_remaining: 1,
  can_use_freeze: true,
  streak_at_risk: true,
  next_milestone_at: 14,
  next_milestone_title: "Two weeks",
  days_to_next_milestone: 2,
  tagline: "Keep the chain",
};

function present(streakOverview: StreakOverviewDto | null) {
  return renderHook(() =>
    useDashboardPresentation({
      sessions: [sessionToday],
      streakOverview,
      weeklyGoalTarget: null,
      hasWeeklyGoal: false,
      weekSessionsCount: 0,
      t,
    }),
  );
}

describe("useDashboardPresentation streak source", () => {
  it("does not invent a streak from sessions when the overview is missing", () => {
    const { result } = present(null);

    expect(result.current.displayOverview).toBeNull();
    expect(result.current.sparkLine).not.toBe("dashboard.spark.streak");
  });

  it("keeps the server freeze and risk when an overview is present", () => {
    const { result } = present(serverOverview);

    expect(result.current.displayOverview).toMatchObject({
      current_streak: 12,
      freezes_remaining: 1,
      can_use_freeze: true,
      streak_at_risk: true,
    });
    expect(result.current.sparkLine).toBe("dashboard.spark.atRisk");
  });
});
