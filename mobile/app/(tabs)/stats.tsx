import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { YourWeekCard } from "../../components/stats/YourWeekCard";
import { StatsKpiStrip } from "../../components/stats/StatsKpiStrip";
import { AppFlame, glyphRowStyle } from "../../components/icons/ProdifyGlyphs";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { AppCard } from "../../components/ui/AppCard";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { ProgressionBarCard } from "../../components/progression/ProgressionBarCard";
import { RankHudChip } from "../../components/progression/RankHudChip";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { progressionOverviewHref } from "../../lib/progressionNavigation";
import {
  WeeklyRecapTeaser,
  isWeeklyRecapTeaserVisible,
} from "../../features/weeklyRecap/WeeklyRecapTeaser";
import { StatsHeatmapSection } from "../../features/stats/components/StatsHeatmapSection";
import { StatsRecordsSection } from "../../features/stats/components/StatsRecordsSection";
import { StatsSection } from "../../features/stats/components/StatsSection";
import { StatsSessionLogSection } from "../../features/stats/components/StatsSessionLogSection";
import { StatsSkeleton } from "../../features/stats/components/StatsSkeleton";
import { StatsTrendsSection } from "../../features/stats/components/StatsTrendsSection";
import { useStatsScreenData } from "../../features/stats/hooks/useStatsScreenData";
import { useStatsScreenLifecycle } from "../../features/stats/hooks/useStatsScreenLifecycle";
import {
  useStatsFilters,
  useStatsPresentation,
} from "../../features/stats/hooks/useStatsPresentation";
import { styles } from "../../features/stats/statsScreen.styles";

export default function StatsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string | string[] }>();
  const focusParam = Array.isArray(params.focus) ? params.focus[0] : params.focus;

  const [filterIdx, setFilterIdx] = useState(0);
  const { filters, filter, periodParam } = useStatsFilters(t, filterIdx);

  const {
    refreshing,
    loading,
    stats,
    heatmapDays,
    records,
    error,
    forecast,
    weeklyGoal,
    commitment,
    goalConfigured,
    weekBusy,
    progression,
    loadStats,
    onRefresh,
    saveWeeklyGoal,
  } = useStatsScreenData(token, periodParam, t);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    void onRefresh();
  }, [onRefresh]);

  const handleStartSession = useCallback(() => {
    router.push("/session/setup" as Href);
  }, [router]);

  const openWeeklyRecap = useCallback(() => {
    router.push("/weekly-recap");
  }, [router]);

  const {
    summary,
    chartData,
    breakdownData,
    recentSessions,
    decoratedRecords,
    productivityHintText,
  } = useStatsPresentation(stats, records, filter.period, t);

  const statCarouselItems = useMemo(() => {
    const middleMetric =
      filter.period === "week"
        ? {
            key: "avg",
            label: t("stats.avgSession"),
            value: summary.avgSession,
            subPositive: true,
          }
        : {
            key: "sessions",
            label: t("stats.sessions"),
            value: summary.sessions,
            subPositive: true,
          };

    return [
      {
        key: "hours",
        label: t("stats.totalHours"),
        value: summary.hours,
        sublabel:
          summary.delta != null
            ? t("stats.vsPrior", {
                sign: summary.delta >= 0 ? "+" : "",
                hours: summary.delta,
              })
            : undefined,
        subPositive: summary.delta == null || summary.delta >= 0,
      },
      middleMetric,
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

  const showInitialLoading = loading && !refreshing && !stats && !error;
  const showInlineLoading = loading && !refreshing && !!stats;

  const { scrollRef, contentFade, handleYourWeekLayout } = useStatsScreenLifecycle({
    token,
    focusParam,
    periodParam,
    showInitialLoading,
    loadStats,
    onFocusHandled: () => router.setParams({ focus: undefined } as never),
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="stats-screen">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <ScreenHeader title={t("stats.title")} actionNode={<RankHudChip from="stats" />} />
          <View style={styles.filterRow}>
            {filters.map((item, index) => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.filterChip,
                  filterIdx === index && styles.filterChipActive,
                  pressed && styles.filterChipPressed,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  setFilterIdx(index);
                }}
              >
                <Text style={[styles.filterLabel, filterIdx === index && styles.filterLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.filterHint}>
            {t("stats.filterScopeHint", { period: filter.label })}
          </Text>
        </View>

        {showInitialLoading ? <StatsSkeleton /> : null}
        {showInlineLoading ? <LoadingState message={t("stats.loading")} /> : null}
        {!loading && error ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("common.tryAgain")}
            onRetry={() =>
              loadStats({ force: true, forceProgressionSync: true }).catch(() => undefined)
            }
          />
        ) : null}

        {!showInitialLoading ? (
          <Animated.View style={[styles.contentFadeWrap, { opacity: contentFade }]}>
            {token ? (
              <View style={styles.heroWrap} onLayout={handleYourWeekLayout}>
                <LinearGradient
                  colors={["#3d1510", "#1a1010", "#0f0f0f"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.mergedHeroShell}
                  testID="stats-merged-hero"
                >
                  <YourWeekCard
                    t={t}
                    goal={weeklyGoal}
                    forecast={forecast}
                    commitment={commitment}
                    heatmapDays={heatmapDays}
                    configured={goalConfigured}
                    busy={weekBusy}
                    hero
                    embedded
                    onSaveGoal={saveWeeklyGoal}
                    onStartSession={handleStartSession}
                  />
                  <View style={styles.mergedHeroDivider} />
                  <StatsKpiStrip
                    items={statCarouselItems}
                    variant="inset"
                    testID="stats-kpi-strip"
                  />
                </LinearGradient>
              </View>
            ) : (
              <StatsKpiStrip items={statCarouselItems} variant="hero" testID="stats-kpi-strip" />
            )}

            {productivityHintText ? (
              <AppCard style={styles.hintCard} testID="stats-ai-insight">
                <Text style={styles.hintLabel}>{t("stats.aiInsightLabel")}</Text>
                <Text style={styles.hintText}>{productivityHintText}</Text>
              </AppCard>
            ) : null}

            <StatsTrendsSection
              t={t}
              chartData={chartData}
              breakdownData={breakdownData}
              onStartSession={handleStartSession}
            />

            <StatsSessionLogSection
              t={t}
              sessions={recentSessions}
              statsPeriod={filter.period}
              onStartSession={handleStartSession}
            />

            <StatsRecordsSection
              t={t}
              records={decoratedRecords}
              onStartSession={handleStartSession}
            />

            <StatsHeatmapSection t={t} days={heatmapDays} />

            <StatsSection
              title={t("stats.progressionSectionTitle")}
              subtitle={t("stats.progressionSectionSubtitle")}
              testID="stats-section-progression"
            >
              <View style={styles.progressionInner}>
                <ProgressionBarCard
                  progression={progression}
                  onPress={() => router.push(progressionOverviewHref("stats"))}
                />
              </View>
            </StatsSection>

            <WeeklyRecapTeaser t={t} onPress={openWeeklyRecap} />

            {!isWeeklyRecapTeaserVisible() ? (
              <View style={styles.weeklyRecapBottomCta}>
                <SecondaryButton
                  label={t("stats.openWeeklyRecap")}
                  onPress={openWeeklyRecap}
                  testID="stats-open-weekly-recap"
                />
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
