import { Animated, Text, View } from "react-native";

import { ProgressionBarCard } from "../../../components/progression/ProgressionBarCard";
import { SecondaryButton } from "../../../components/ui/SecondaryButton";
import { AppCard } from "../../../components/ui/AppCard";
import { isWeeklyRecapTeaserVisible, WeeklyRecapTeaser } from "../../weeklyRecap/WeeklyRecapTeaser";
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
  return (
    <Animated.View style={[styles.contentFadeWrap, { opacity: controller.contentFade }]}>
      <StatsHero controller={controller} />
      {controller.productivityHintText ? (
        <AppCard style={styles.hintCard} testID="stats-ai-insight">
          <Text style={styles.hintLabel}>{t("stats.aiInsightLabel")}</Text>
          <Text style={styles.hintText}>{controller.productivityHintText}</Text>
        </AppCard>
      ) : null}
      <StatsTrendsSection
        t={t}
        chartData={controller.chartData}
        breakdownData={controller.breakdownData}
        onStartSession={controller.startSession}
      />
      <StatsSessionLogSection
        t={t}
        sessions={controller.recentSessions}
        statsPeriod={controller.filter.period}
        onStartSession={controller.startSession}
      />
      <StatsRecordsSection
        t={t}
        records={controller.decoratedRecords}
        onStartSession={controller.startSession}
      />
      <StatsHeatmapSection t={t} days={controller.heatmapDays} />
      <StatsSection
        title={t("stats.progressionSectionTitle")}
        subtitle={t("stats.progressionSectionSubtitle")}
        testID="stats-section-progression"
      >
        <View style={styles.progressionInner}>
          <ProgressionBarCard
            progression={controller.progression}
            loading={!controller.progressionSettled}
            onPress={controller.openProgression}
          />
        </View>
      </StatsSection>
      <WeeklyRecapTeaser t={t} onPress={controller.openWeeklyRecap} />
      {!isWeeklyRecapTeaserVisible() ? (
        <View style={styles.weeklyRecapBottomCta}>
          <SecondaryButton
            label={t("stats.openWeeklyRecap")}
            onPress={controller.openWeeklyRecap}
            testID="stats-open-weekly-recap"
          />
        </View>
      ) : null}
    </Animated.View>
  );
}
