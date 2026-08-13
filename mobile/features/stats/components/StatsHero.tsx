import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { AppFlame, glyphRowStyle } from "../../../components/icons/ProdifyGlyphs";
import { StatsKpiStrip, type KpiItem } from "../../../components/stats/StatsKpiStrip";
import { YourWeekCard } from "../../../components/stats/YourWeekCard";
import type { StatsScreenController } from "../hooks/useStatsScreenController";
import { styles } from "../statsScreen.styles";

export function StatsHero({ controller }: { controller: StatsScreenController }) {
  const { t, summary, filter } = controller;
  const items = useMemo<KpiItem[]>(() => {
    const middle =
      filter.period === "week"
        ? { key: "avg", label: t("stats.avgSession"), value: summary.avgSession }
        : { key: "sessions", label: t("stats.sessions"), value: summary.sessions };
    return [
      {
        key: "hours",
        label: t("stats.totalHours"),
        value: summary.hours,
        sublabel:
          summary.delta == null
            ? undefined
            : t("stats.vsPrior", { sign: summary.delta >= 0 ? "+" : "", hours: summary.delta }),
        subPositive: summary.delta == null || summary.delta >= 0,
      },
      { ...middle, subPositive: true },
      {
        key: "streak",
        label: t("stats.currentStreak"),
        value: (
          <View style={glyphRowStyle}>
            <AppFlame size={18} />
            <Text style={styles.heroStatValue}>{summary.streak}</Text>
          </View>
        ),
        sublabel: t("stats.bestStreakSub", { days: summary.bestStreak }),
        subPositive: true,
      },
    ];
  }, [filter.period, summary, t]);
  if (!controller.token)
    return <StatsKpiStrip items={items} variant="hero" testID="stats-kpi-strip" />;
  return (
    <View style={styles.heroWrap} onLayout={controller.handleYourWeekLayout}>
      <LinearGradient
        colors={["#3d1510", "#1a1010", "#0f0f0f"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.mergedHeroShell}
        testID="stats-merged-hero"
      >
        <YourWeekCard
          t={t}
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
        <View style={styles.mergedHeroDivider} />
        <StatsKpiStrip items={items} variant="inset" testID="stats-kpi-strip" />
      </LinearGradient>
    </View>
  );
}
