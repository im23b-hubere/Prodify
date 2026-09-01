import { Animated, Text, View } from "react-native";

import { ProgressionBarCard } from "../../../components/progression/ProgressionBarCard";
import type { StatsScreenController } from "../hooks/useStatsScreenController";
import { styles } from "../statsScreen.styles";
import { StatsHeatmapSection } from "./StatsHeatmapSection";
import { StatsHero } from "./StatsHero";
import { StatsRecordsSection } from "./StatsRecordsSection";
import { StatsSection } from "./StatsSection";
import { StatsSessionLogSection } from "./StatsSessionLogSection";
import { StatsTrendsSection } from "./StatsTrendsSection";

export function StatsScreenContent({ controller }: { controller: StatsScreenController }) {
  const { t } = controller;
  const showProgression = controller.progressionSettled || controller.progression != null;
  return (
    <Animated.View style={[styles.contentFadeWrap, { opacity: controller.contentFade }]}>
      <StatsHero controller={controller} />
      {controller.productivityHintText ? (
        <View style={styles.hintCard} testID="stats-ai-insight">
          <Text style={styles.hintLabel}>{t("stats.aiInsightLabel")}</Text>
          <Text style={styles.hintText}>{controller.productivityHintText}</Text>
        </View>
      ) : null}
      <StatsTrendsSection
        t={t}
        chartData={controller.chartData}
        breakdownData={controller.breakdownData}
      />
      <StatsSessionLogSection
        t={t}
        sessions={controller.recentSessions}
        statsPeriod={controller.filter.period}
      />
      <StatsRecordsSection t={t} records={controller.decoratedRecords} />
      <StatsHeatmapSection t={t} days={controller.heatmapDays} />
      {showProgression ? (
        <StatsSection title={t("stats.progressionSectionTitle")} testID="stats-section-progression">
          <ProgressionBarCard
            progression={controller.progression}
            onPress={controller.openProgression}
          />
        </StatsSection>
      ) : null}
    </Animated.View>
  );
}
