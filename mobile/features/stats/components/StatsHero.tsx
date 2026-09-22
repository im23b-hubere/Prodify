import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

import { YourWeekCard } from "../../../components/stats/YourWeekCard";
import type { StatsScreenController } from "../hooks/useStatsScreenController";
import { styles } from "../statsScreen.styles";

export function StatsHero({ controller }: { controller: StatsScreenController }) {
  if (!controller.token) return null;
  return (
    <View style={styles.heroWrap} onLayout={controller.handleYourWeekLayout}>
      <LinearGradient
        colors={["#3d1510", "#1a1010", "#0f0f0f"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroShell}
        testID="stats-week-hero"
      >
        <YourWeekCard
          t={controller.t}
          goal={controller.weeklyGoal}
          forecast={controller.forecast}
          commitment={controller.commitment}
          heatmapDays={controller.heatmapDays}
          configured={controller.goalConfigured}
          busy={controller.weekBusy}
          hero
          embedded
          onSaveGoal={controller.saveWeeklyGoal}
          onStartSession={controller.startSession}
        />
      </LinearGradient>
    </View>
  );
}
