import { Animated } from "react-native";

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
      <StatsTrendsSection
        t={t}
        chartData={controller.chartData}
        recordMarks={controller.recordMarks}
        period={controller.filter.period}
      />
      <StatsWoranSection
        t={t}
        rows={controller.woranRows}
        onOpenBranch={controller.openWoranBranch}
      />
      <SkillTreeSection skillProfile={controller.skillProfile} />
      <StatsSessionLogSection
        t={t}
        sessions={controller.recentSessions}
        statsPeriod={controller.filter.period}
      />
      <StatsRecordsSection t={t} records={controller.decoratedRecords} />
    </Animated.View>
  );
}
