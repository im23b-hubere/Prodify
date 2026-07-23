import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { fontFamily } from "../../constants/fonts";
import { colors, motion, radii, spacing, typography, ui } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { translateInsightItem } from "../../lib/sessionInsightsI18n";
import { progressionOverviewHref } from "../../lib/progressionNavigation";
import {
  WeeklyRecapTeaser,
  isWeeklyRecapTeaserVisible,
} from "../../features/weeklyRecap/WeeklyRecapTeaser";
import { STATS_BREAKDOWN_COLORS } from "../../features/stats/constants";
import { StatsHeatmapSection } from "../../features/stats/components/StatsHeatmapSection";
import { StatsRecordsSection } from "../../features/stats/components/StatsRecordsSection";
import { StatsSection } from "../../features/stats/components/StatsSection";
import { StatsSessionLogSection } from "../../features/stats/components/StatsSessionLogSection";
import { StatsSkeleton } from "../../features/stats/components/StatsSkeleton";
import { StatsTrendsSection } from "../../features/stats/components/StatsTrendsSection";
import { useStatsScreenData } from "../../features/stats/hooks/useStatsScreenData";
import type { StatsFilter } from "../../features/stats/types";
import { buildChartData, buildStatsSummary } from "../../features/stats/utils/chartData";
import { decorateRecords } from "../../features/stats/utils/records";

export default function StatsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string | string[] }>();
  const focusParam = Array.isArray(params.focus) ? params.focus[0] : params.focus;

  const filters = useMemo<readonly StatsFilter[]>(
    () => [
      { key: "7d", label: t("stats.filter7d"), period: "week" },
      { key: "30d", label: t("stats.filter30d"), period: "month" },
      { key: "all", label: t("stats.filterAll"), period: "all" },
    ],
    [t],
  );

  const [filterIdx, setFilterIdx] = useState(0);
  const filter = filters[filterIdx];
  const periodParam =
    filter.period === "week" ? "week" : filter.period === "month" ? "month" : "all";

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

  const scrollRef = useRef<ScrollView>(null);
  const yourWeekOffsetY = useRef(0);
  const pendingYourWeekFocus = useRef(false);
  const lastPeriodParamRef = useRef<string | null>(null);
  const contentFade = useRef(new Animated.Value(0)).current;

  const tryScrollToYourWeek = useCallback(() => {
    if (!pendingYourWeekFocus.current || yourWeekOffsetY.current <= 0) return;
    pendingYourWeekFocus.current = false;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, yourWeekOffsetY.current - spacing.md),
        animated: true,
      });
    });
    router.setParams({ focus: undefined } as never);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      if (focusParam === "yourWeek") {
        pendingYourWeekFocus.current = true;
      }
      loadStats().catch(() => undefined);
    }, [focusParam, loadStats]),
  );

  useEffect(() => {
    if (lastPeriodParamRef.current === null) {
      lastPeriodParamRef.current = periodParam;
      return;
    }
    if (lastPeriodParamRef.current === periodParam) return;
    lastPeriodParamRef.current = periodParam;
    loadStats({ force: true }).catch(() => undefined);
  }, [loadStats, periodParam]);

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

  const summary = useMemo(() => buildStatsSummary(stats), [stats]);
  const chartData = useMemo(() => buildChartData(stats, filter.period), [filter.period, stats]);
  const breakdownData = useMemo(
    () =>
      (stats?.breakdown ?? []).map((item, idx) => ({
        label: sessionTypeLabel(String(item.session_type), t),
        value: Math.max(0, Math.round(item.percent)),
        sessions: item.sessions,
        color: STATS_BREAKDOWN_COLORS[idx % STATS_BREAKDOWN_COLORS.length],
      })),
    [stats, t],
  );
  const recentSessions = useMemo(() => stats?.recent_sessions ?? [], [stats?.recent_sessions]);
  const decoratedRecords = useMemo(() => decorateRecords(records), [records]);
  const productivityHintText = useMemo(() => {
    if (stats?.productivity_hint_item) {
      return translateInsightItem(stats.productivity_hint_item, t);
    }
    return stats?.productivity_hint ?? null;
  }, [stats?.productivity_hint_item, stats?.productivity_hint, t]);

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

  useEffect(() => {
    if (!pendingYourWeekFocus.current || showInitialLoading || !token) return;
    tryScrollToYourWeek();
  }, [showInitialLoading, token, tryScrollToYourWeek]);

  useEffect(() => {
    if (showInitialLoading) {
      contentFade.setValue(0);
      return;
    }
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentFade, showInitialLoading]);

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
              <View
                style={styles.heroWrap}
                onLayout={(event) => {
                  yourWeekOffsetY.current = event.nativeEvent.layout.y;
                  tryScrollToYourWeek();
                }}
              >
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: ui.screenPadding, paddingBottom: spacing.xxl },
  headerRow: { marginBottom: spacing.md, gap: spacing.sm },
  filterHint: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  filterRow: { flexDirection: "row", gap: spacing.sm },
  filterChip: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  filterChipActive: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.2)" },
  filterChipPressed: { opacity: motion.pressOpacity, transform: [{ scale: motion.pressScale }] },
  filterLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  filterLabelActive: { color: colors.textPrimary },
  contentFadeWrap: {
    gap: spacing.lg,
  },
  heroStatValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  heroWrap: {
    marginBottom: spacing.xs,
  },
  mergedHeroShell: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  mergedHeroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  progressionInner: {
    marginTop: -spacing.md,
  },
  hintCard: {
    backgroundColor: "rgba(162,89,255,0.12)",
    borderColor: colors.secondary,
    gap: spacing.xs,
  },
  hintLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hintText: { color: colors.textSecondary, ...typography.meta, lineHeight: 20 },
  weeklyRecapBottomCta: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
});
