import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";
import type { ForecastComputed } from "../../lib/forecastEngine";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../constants/theme";
import { WeeklyQuestCard } from "../studio/WeeklyQuestCard";

type Props = {
  t: (key: string, options?: Record<string, unknown>) => string;
  feedback: SessionFeedbackComputed;
  weekSessionsCount: number;
  weeklyGoalTarget: number | null;
  paceForecast: ForecastComputed | null;
};

/** Compact weekly quest block used on session complete and stats-adjacent flows. */
export function SessionCompleteWeekCard({
  t,
  feedback,
  weekSessionsCount,
  weeklyGoalTarget,
  paceForecast,
}: Props) {
  const hasGoal = weeklyGoalTarget != null && weeklyGoalTarget > 0;
  if (!hasGoal) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <WeeklyQuestCard
        mode="progress"
        t={t}
        feedback={feedback}
        weekSessionsCount={weekSessionsCount}
        weeklyGoalTarget={weeklyGoalTarget}
        paceForecast={paceForecast}
        testID="session-complete-week-quest"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    width: "100%",
  },
});
