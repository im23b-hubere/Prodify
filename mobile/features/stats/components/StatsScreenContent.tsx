import { Animated, Text, View } from "react-native";

import { SkillTreeSection } from "../../skills/components/SkillTreeSection";
import type { StatsScreenController } from "../hooks/useStatsScreenController";
import { styles } from "../statsScreen.styles";
import { StatsHero } from "./StatsHero";
import { StatsKpiBlock } from "./StatsKpiBlock";
import { StatsRecordsSection } from "./StatsRecordsSection";
import { StatsSessionLogSection } from "./StatsSessionLogSection";
import { StatsTrendsSection } from "./StatsTrendsSection";
import { StatsWoranSection } from "./StatsWoranSection";

export function StatsScreenContent({ controller }: { controller: StatsScreenController }) {
  const { t } = controller;
  return (
    <Animated.View style={[styles.contentFadeWrap, { opacity: controller.contentFade }]}>
      <StatsHero controller={controller} />
      <StatsKpiBlock controller={controller} />
      <SkillTreeSection skillProfile={controller.skillProfile} />
      <StatsWoranSection
        t={t}
        rows={controller.woranRows}
        onOpenBranch={controller.openWoranBranch}
      />
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
        period={controller.filter.period}
      />
      <StatsSessionLogSection
        t={t}
        sessions={controller.recentSessions}
        statsPeriod={controller.filter.period}
      />
      <StatsRecordsSection t={t} records={controller.decoratedRecords} />
    </Animated.View>
  );
}
