import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DashboardMotivationCard } from "../../components/dashboard/DashboardMotivationCard";
import { AppFlame, RecordGlyph, glyphRowStyle } from "../../components/icons/ProdifyGlyphs";
import { ErrorState } from "../../components/states/ErrorState";
import { AppCard } from "../../components/ui/AppCard";
import { StatCard } from "../../components/ui/StatCard";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { ProgressionBarCard } from "../../components/progression/ProgressionBarCard";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, motion, radii, spacing, typography, ui } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { debugLog } from "../../lib/debugLog";
import {
  parseMotivationalMessage,
  translateMotivationalMessage,
  type MotivationalMessageDto,
} from "../../lib/motivationApi";
import {
  generateMotivationMessage,
  getTimeBasedGreeting,
  getTimeOfDay,
} from "../../lib/motivationEngine";
import {
  formatIsoDateShortLocal,
  formatSessionListDate,
  weekdayLetterFromIsoDay,
} from "../../lib/sessionTime";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { translateInsightItem } from "../../lib/sessionInsightsI18n";
import { progressionOverviewHref } from "../../lib/progressionNavigation";
import { syncProgression } from "../../lib/progressionSync";
import { ActivityHeatmapLegend } from "../../components/charts/ActivityHeatmapLegend";
import { heatmapCellColor } from "../../lib/heatmapStyle";
import { tryParseGoalForecastDto } from "../../lib/outcomesDto";
import {
  tryParseHeatmapDays,
  tryParsePersonalRecords,
  tryParseSessionStatsDto,
} from "../../lib/statsDto";
import type { SessionDto, SessionStatsDto } from "../../types/session";
import type { GoalForecastDto, ProgressionDto } from "../../types/outcomes";

type HeatmapDay = { date: string; seconds: number; intensity: number };
type PersonalRecord = {
  key: string;
  label: string;
  value: string;
  context: string | null;
  occurred_at: string | null;
};

const BREAKDOWN_COLORS = [colors.primary, colors.secondary, colors.success];
const CALENDAR_DAY_MS = 24 * 60 * 60 * 1000;
type TTranslate = TFunction;
type DecoratedRecord = PersonalRecord & { score: number; isFresh: boolean };

function formatDuration(seconds: number) {
  const s = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return `${hours}h ${rest}m`;
}

function formatRecordDate(value: string | null, t: (key: string) => string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${t("stats.recordAchieved")} ${date.toLocaleDateString()}`;
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatRecordContext(record: PersonalRecord, t: TTranslate) {
  if (!record.context) return null;
  if (record.key === "longest_session") {
    return sessionTypeLabel(record.context, t);
  }
  if (record.key === "most_sessions_day") {
    const date = new Date(record.context);
    return Number.isNaN(date.getTime())
      ? record.context
      : t("stats.recordOnDate", { date: date.toLocaleDateString() });
  }
  if (record.key === "productive_week") {
    const rawDate = record.context.replace("Week of ", "").trim();
    const date = new Date(rawDate);
    return Number.isNaN(date.getTime())
      ? record.context
      : t("stats.recordWeekOf", { date: date.toLocaleDateString() });
  }
  if (record.context === "Now") return t("stats.recordNow");
  if (record.context === "All-time") return t("stats.recordAllTime");
  return record.context;
}

function recordTitle(key: string, fallback: string, t: TTranslate) {
  if (key === "longest_session") return t("stats.recordLongestSession");
  if (key === "most_sessions_day") return t("stats.recordMostSessionsDay");
  if (key === "longest_streak") return t("stats.recordLongestStreak");
  if (key === "current_streak") return t("stats.recordCurrentStreak");
  if (key === "productive_week") return t("stats.recordProductiveWeek");
  return fallback;
}

function recordPriorityScore(key: string) {
  if (key === "current_streak") return 100;
  if (key === "longest_streak") return 90;
  if (key === "productive_week") return 80;
  if (key === "most_sessions_day") return 70;
  if (key === "longest_session") return 60;
  return 20;
}

const BAR_CHART_HEIGHT = 104;

type BarPoint = { x: string; y: number; label: string };

function SkeletonLine({
  style,
  durationMs = 850,
  minOpacity = 0.5,
}: {
  style?: object;
  durationMs?: number;
  minOpacity?: number;
}) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: minOpacity,
          duration: durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [durationMs, minOpacity, pulse]);

  return <Animated.View style={[styles.skeletonLine, { opacity: pulse }, style]} />;
}

function StatsSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
      >
        {[0, 1, 2].map((idx) => (
          <AppCard key={`sk-stat-${idx}`} style={styles.skeletonStatCard}>
            <SkeletonLine style={styles.skeletonLabel} durationMs={760} minOpacity={0.56} />
            <SkeletonLine style={styles.skeletonValue} durationMs={760} minOpacity={0.56} />
            <SkeletonLine style={styles.skeletonSub} durationMs={760} minOpacity={0.56} />
          </AppCard>
        ))}
      </ScrollView>
      {[0, 1, 2].map((idx) => (
        <AppCard key={`sk-card-${idx}`} style={styles.skeletonBlockCard}>
          <SkeletonLine style={styles.skeletonTitle} durationMs={980} minOpacity={0.5} />
          <SkeletonLine style={styles.skeletonBody} durationMs={980} minOpacity={0.5} />
          <SkeletonLine style={styles.skeletonBodyShort} durationMs={980} minOpacity={0.5} />
        </AppCard>
      ))}
    </View>
  );
}

function SessionsPerDayChart({ data }: { data: BarPoint[] }) {
  if (data.length === 0) return null;
  const maxY = Math.max(1, ...data.map((d) => d.y));
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <FlatList
      horizontal
      nestedScrollEnabled={Platform.OS === "android"}
      data={data}
      keyExtractor={(d, i) => `${d.label}-${i}`}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.barScrollContent}
      renderItem={({ item: d }) => {
        const h = Math.max(3, (d.y / maxY) * BAR_CHART_HEIGHT);
        const isToday = d.label === todayIso;
        return (
          <View style={styles.barColumn}>
            <View style={styles.barTrack}>
              <LinearGradient
                colors={isToday ? ["#ff8f66", colors.primary] : ["#ff5a1f", colors.primary]}
                style={[styles.barFill, { height: h }]}
              />
            </View>
            <Text style={styles.barAxisLabel} numberOfLines={1}>
              {d.x}
            </Text>
            <Text style={styles.barCount}>{d.y}</Text>
          </View>
        );
      }}
    />
  );
}

export default function StatsScreen() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const filters = useMemo(
    () =>
      [
        { key: "7d" as const, label: t("stats.filter7d"), period: "week" as const },
        { key: "30d" as const, label: t("stats.filter30d"), period: "month" as const },
        { key: "all" as const, label: t("stats.filterAll"), period: "all" as const },
      ] as const,
    [t],
  );
  const [filterIdx, setFilterIdx] = useState(0);
  const filter = filters[filterIdx];
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<GoalForecastDto | null>(null);
  const [progression, setProgression] = useState<ProgressionDto | null>(null);
  const [serverMotivationDto, setServerMotivationDto] = useState<MotivationalMessageDto | null>(
    null,
  );
  const loadSeq = useRef(0);
  const mounted = useRef(true);
  const initialFocusLoadDone = useRef(false);
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadSeq.current += 1;
    };
  }, []);

  const periodParam =
    filter.period === "week" ? "week" : filter.period === "month" ? "month" : "all";

  const loadStats = useCallback(
    async (opts: { forceProgressionSync?: boolean } = {}) => {
      const forceProgressionSync = Boolean(opts.forceProgressionSync);
      if (!token) return;
      const seq = ++loadSeq.current;
      if (mounted.current) setLoading(true);
      if (mounted.current) setError(null);
      try {
        const [rawStats, rawHm, rawRec] = await Promise.all([
          apiJson<unknown>(`/sessions/stats?period=${periodParam}`, { token }),
          apiJson<unknown>(`/stats/heatmap`, { token }),
          apiJson<unknown>(`/stats/records`, { token }),
        ]);
        if (!mounted.current || seq !== loadSeq.current) return;
        const parsed = tryParseSessionStatsDto(rawStats);
        if (!parsed) {
          debugLog("stats", "invalid_stats_payload", { period: periodParam });
          if (mounted.current) {
            setStats(null);
            setHeatmapDays([]);
            setRecords([]);
            setProgression(null);
            setError(t("stats.invalidResponse"));
          }
          return;
        }
        if (mounted.current) {
          setStats(parsed);
          setHeatmapDays(tryParseHeatmapDays(rawHm));
          setRecords(tryParsePersonalRecords(rawRec));
        }
        // Show core stats first, then hydrate secondary sections.
        if (mounted.current && seq === loadSeq.current) setLoading(false);

        const [progressionRes, forecastRes, motivationRes] = await Promise.allSettled([
          syncProgression(token, { force: forceProgressionSync }),
          apiJson<unknown>("/outcomes/goal-forecast/current", { token }),
          apiJson<unknown>("/motivational-messages/random", { token }),
        ]);
        if (!mounted.current || seq !== loadSeq.current) return;

        const progressionRaw = progressionRes.status === "fulfilled" ? progressionRes.value : null;
        const forecastRaw = forecastRes.status === "fulfilled" ? forecastRes.value : null;
        const motivationRaw = motivationRes.status === "fulfilled" ? motivationRes.value : null;

        setForecast(forecastRaw ? tryParseGoalForecastDto(forecastRaw) : null);
        setProgression(progressionRaw);
        setServerMotivationDto(parseMotivationalMessage(motivationRaw));
      } catch (e) {
        if (!mounted.current || seq !== loadSeq.current) return;
        const msg = e instanceof Error ? e.message : t("stats.loadFailed");
        debugLog("stats", "stats_fetch_failed", { period: periodParam, message: msg });
        if (mounted.current) setError(msg);
      } finally {
        if (!mounted.current || seq !== loadSeq.current) return;
        setLoading(false);
      }
    },
    [periodParam, token, t],
  );

  useFocusEffect(
    useCallback(() => {
      if (initialFocusLoadDone.current) {
        loadStats().catch(() => undefined);
        return;
      }
      initialFocusLoadDone.current = true;
      loadStats().catch(() => undefined);
    }, [loadStats]),
  );

  const onRefresh = useCallback(async () => {
    if (mounted.current) setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await loadStats({ forceProgressionSync: true }).catch((e) => {
      if (mounted.current) setError(e instanceof Error ? e.message : t("stats.loadFailed"));
    });
    if (mounted.current) setRefreshing(false);
  }, [loadStats, t]);

  const summary = useMemo(() => {
    const s = stats?.summary;
    if (!s) {
      return {
        hours: "0h",
        sessions: "0",
        avgSession: "0m",
        streak: 0,
        bestStreak: 0,
        delta: null as number | null,
      };
    }
    const sec = Number.isFinite(s.total_seconds) && s.total_seconds >= 0 ? s.total_seconds : 0;
    const hours = (sec / 3600).toFixed(1);
    const delta = s.hours_delta_vs_prior_period;
    return {
      hours: `${hours}h`,
      sessions: String(s.total_sessions),
      avgSession: formatDuration(s.avg_session_seconds),
      streak: s.current_streak_days,
      bestStreak: s.best_streak_days,
      delta,
    };
  }, [stats]);

  const chartData = useMemo((): BarPoint[] => {
    const points = stats?.trend ?? [];
    if (filter.period === "week") {
      const sessionsByDay = new Map<string, number>();
      for (const point of points) {
        if (point?.label) {
          sessionsByDay.set(
            point.label,
            Number.isFinite(point.sessions) && point.sessions >= 0 ? point.sessions : 0,
          );
        }
      }
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));
        const isoLabel = localDateKey(date);
        return {
          x: weekdayLetterFromIsoDay(isoLabel),
          y: sessionsByDay.get(isoLabel) ?? 0,
          label: isoLabel,
        };
      });
    }
    if (points.length === 0) return [];
    return points.map((p) => ({
      x: formatIsoDateShortLocal(p.label),
      y: Number.isFinite(p.sessions) && p.sessions >= 0 ? p.sessions : 0,
      label: p.label,
    }));
  }, [filter.period, stats]);

  const breakdownData = useMemo(
    () =>
      (stats?.breakdown ?? []).map((item, idx) => ({
        label: sessionTypeLabel(String(item.session_type), t),
        value: Math.max(0, Math.round(item.percent)),
        sessions: item.sessions,
        color: BREAKDOWN_COLORS[idx % BREAKDOWN_COLORS.length],
      })),
    [stats, t],
  );

  const recent = stats?.recent_sessions ?? [];

  const todaySessionCount = useMemo(() => {
    const todayKey = localDateKey(new Date());
    return recent.filter((session) => {
      if (!session.started_at) return false;
      const startedAt = new Date(session.started_at);
      if (!Number.isFinite(startedAt.getTime())) return false;
      return localDateKey(startedAt) === todayKey;
    }).length;
  }, [recent]);

  const weekSessionCount = useMemo(() => {
    if (filter.period === "week" && stats?.summary) {
      return Math.max(0, stats.summary.total_sessions ?? 0);
    }
    return chartData.reduce((sum, point) => sum + point.y, 0);
  }, [chartData, filter.period, stats?.summary]);

  const serverMotivationLine = useMemo(() => {
    if (!serverMotivationDto) return null;
    return translateMotivationalMessage(serverMotivationDto, t);
  }, [serverMotivationDto, t]);

  const motivationMessage = useMemo(
    () =>
      generateMotivationMessage({
        streak: summary.streak,
        todayCount: todaySessionCount,
        weekCount: weekSessionCount,
        friends: { activeNow: 0, topThisWeek: null },
        timeOfDay: getTimeOfDay(),
        lastSessionFocus: recent[0]?.focus_score ?? null,
      }),
    [recent, summary.streak, todaySessionCount, weekSessionCount],
  );

  const showInitialLoading = loading && !refreshing && !stats && !error;
  const showInlineLoading = loading && !refreshing && !!stats;

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

  const decoratedRecords = useMemo<DecoratedRecord[]>(() => {
    const now = Date.now();
    const FRESH_MS = 14 * CALENDAR_DAY_MS;
    return records
      .map((record) => {
        const occurredDate = parseIsoDate(record.occurred_at);
        const occurredMs = occurredDate?.getTime() ?? 0;
        const isFresh = occurredDate ? now - occurredMs <= FRESH_MS : false;
        return {
          ...record,
          score: recordPriorityScore(record.key) + (isFresh ? 1000 : 0),
          isFresh,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [records]);

  const productivityHintText = useMemo(() => {
    if (stats?.productivity_hint_item) {
      return translateInsightItem(stats.productivity_hint_item, t);
    }
    return stats?.productivity_hint ?? null;
  }, [stats?.productivity_hint_item, stats?.productivity_hint, t]);

  const weekGoal = useMemo(() => {
    if (filter.period !== "week" || !stats?.trend?.length) return null;
    const daysWith = new Set(stats.trend.map((t) => t.label).filter(Boolean)).size;
    return { daysWith, goal: 7 };
  }, [filter.period, stats?.trend]);
  const forecastRiskKey = forecast
    ? forecast.risk_level === "on_track"
      ? "stats.forecastRiskOnTrack"
      : forecast.risk_level === "at_risk"
        ? "stats.forecastRiskAtRisk"
        : "stats.forecastRiskOffTrack"
    : null;
  const forecastProgressPercent = useMemo(() => {
    if (!forecast || forecast.target_sessions <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, (forecast.completed_sessions / forecast.target_sessions) * 100),
    );
  }, [forecast]);

  const statCarouselItems = useMemo(
    () => [
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
      {
        key: "sessions",
        label: t("stats.sessions"),
        value: summary.sessions,
        subPositive: true,
      },
      {
        key: "streak",
        label: t("stats.currentStreak"),
        value: (
          <View style={glyphRowStyle}>
            <AppFlame size={18} />
            <Text style={styles.statValueText}>{summary.streak}</Text>
          </View>
        ),
        sublabel: `${t("stats.bestStreakSub", { days: summary.bestStreak })}\n${t("stats.streakScopeNote")}`,
        subPositive: true,
      },
    ],
    [summary, t],
  );

  const renderRecent = useCallback(
    ({ item }: { item: SessionDto }) => {
      const sid = item.id;
      const canOpen = typeof sid === "number" && Number.isFinite(sid) && sid > 0;
      return (
        <Pressable
          style={({ pressed }) => [styles.recentRow, pressed && styles.recentRowPressed]}
          onPress={() => {
            if (!canOpen) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            router.push(`/session/${sid}`);
          }}
          disabled={!canOpen}
        >
          <Text style={styles.recentType}>
            {sessionTypeLabel(String(item.session_type ?? "beat_making"), t)}
          </Text>
          <View style={styles.recentMid}>
            <Text style={styles.recentDur}>{formatDuration(item.duration_seconds ?? 0)}</Text>
            <Text style={styles.recentDate}>{formatSessionListDate(item.started_at)}</Text>
          </View>
          <Text style={styles.recentChev}>›</Text>
        </Pressable>
      );
    },
    [router, t],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <ScreenHeader title={t("stats.title")} />
          <View style={styles.filterRow}>
            {filters.map((f, i) => (
              <Pressable
                key={f.key}
                style={({ pressed }) => [
                  styles.filterChip,
                  filterIdx === i && styles.filterChipActive,
                  pressed && styles.filterChipPressed,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  setFilterIdx(i);
                }}
              >
                <Text style={[styles.filterLabel, filterIdx === i && styles.filterLabelActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.filterHint}>{t("stats.sessionFilterScope")}</Text>
        </View>
        {token ? (
          <View style={styles.motivationWrap}>
            <DashboardMotivationCard
              greeting={getTimeBasedGreeting()}
              userName={user?.username ?? t("dashboard.defaultUserName")}
              message={motivationMessage}
              serverMessage={serverMotivationLine}
              todaySessionCount={todaySessionCount}
            />
          </View>
        ) : null}
        {showInitialLoading ? <StatsSkeleton /> : null}
        {showInlineLoading ? (
          <View style={styles.inlineLoadingRow}>
            <Text style={styles.inlineLoadingText}>{t("stats.loading")}</Text>
          </View>
        ) : null}
        {!loading && error ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("common.tryAgain")}
            onRetry={() => loadStats({ forceProgressionSync: true }).catch(() => undefined)}
          />
        ) : null}
        {!showInitialLoading ? (
          <Animated.View style={[styles.contentFadeWrap, { opacity: contentFade }]}>
            {!showInitialLoading ? (
              <AppCard style={styles.chartCard}>
                <Text style={styles.cardTitle}>{t("stats.recordsTitle")}</Text>
                {decoratedRecords.length === 0 ? (
                  <Text style={styles.emptyText}>{t("stats.recordsEmpty")}</Text>
                ) : (
                  <View style={styles.recordsWrap}>
                    {decoratedRecords.slice(0, 3).map((r, idx) => {
                      const meta = formatRecordDate(r.occurred_at, t);
                      const displayContext = formatRecordContext(r, t);
                      return (
                        <View
                          key={`top-${r.key}${r.occurred_at ?? ""}`}
                          style={[styles.recordCard, idx === 0 && styles.recordCardFeatured]}
                        >
                          <View style={styles.recordTitleRow}>
                            <View style={styles.recordLabelWrap}>
                              <RecordGlyph recordKey={r.key} size={16} />
                              <Text style={styles.recordLabel}>
                                {recordTitle(r.key, r.label, t)}
                              </Text>
                            </View>
                            <View style={styles.recordBadgesRow}>
                              {r.isFresh ? (
                                <View style={[styles.recordBadge, styles.recordBadgeFresh]}>
                                  <Text
                                    style={[styles.recordBadgeText, styles.recordBadgeTextFresh]}
                                  >
                                    {t("stats.recordFresh")}
                                  </Text>
                                </View>
                              ) : null}
                              {idx === 0 ? (
                                <View style={styles.recordBadge}>
                                  <Text style={styles.recordBadgeText}>
                                    {t("stats.recordBest")}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <Text style={styles.recordVal}>{r.value}</Text>
                          {displayContext ? (
                            <Text style={styles.recordCtx}>{displayContext}</Text>
                          ) : null}
                          {meta ? <Text style={styles.recordMeta}>{meta}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </AppCard>
            ) : null}

            {!showInitialLoading && (weekGoal || forecast) ? (
              <AppCard style={styles.goalCard}>
                {forecast ? (
                  <>
                    <View style={styles.goalHeaderRow}>
                      <Text style={styles.cardTitle}>{t("stats.forecastTitle")}</Text>
                      {forecastRiskKey ? (
                        <Text
                          style={[
                            styles.forecastRiskPill,
                            forecast.risk_level === "on_track" && styles.forecastRiskOnTrack,
                            forecast.risk_level === "at_risk" && styles.forecastRiskAtRisk,
                            forecast.risk_level === "off_track" && styles.forecastRiskOffTrack,
                          ]}
                        >
                          {t(forecastRiskKey)}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.forecastProgressLine}>
                      {t("stats.forecastProgress", {
                        done: forecast.completed_sessions,
                        target: forecast.target_sessions,
                      })}
                    </Text>
                    <View style={styles.goalProgressTrack}>
                      <View
                        style={[styles.goalProgressFill, { width: `${forecastProgressPercent}%` }]}
                      />
                    </View>
                    <Text style={styles.goalSub}>
                      {t("stats.forecastRemaining", {
                        n: forecast.remaining_sessions,
                        days: forecast.days_left,
                      })}
                    </Text>
                  </>
                ) : null}
                {weekGoal ? (
                  <View style={forecast ? styles.forecastBlock : undefined}>
                    <Text style={styles.goalTitle}>
                      {t("stats.weeklyPresence", { have: weekGoal.daysWith, goal: weekGoal.goal })}
                    </Text>
                    <Text style={styles.goalSub}>
                      {weekGoal.daysWith >= weekGoal.goal
                        ? t("stats.weeklyCrushed")
                        : t("stats.weeklyMoreDays", {
                            count: weekGoal.goal - weekGoal.daysWith,
                            n: weekGoal.goal - weekGoal.daysWith,
                          })}
                    </Text>
                  </View>
                ) : null}
              </AppCard>
            ) : null}

            <FlatList
              horizontal
              data={statCarouselItems}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <StatCard
                  label={item.label}
                  value={item.value}
                  sublabel={item.sublabel}
                  subPositive={item.subPositive}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardRow}
              snapToInterval={172}
              decelerationRate="fast"
              nestedScrollEnabled={Platform.OS === "android"}
            />

            {!showInitialLoading ? (
              <AppCard style={styles.chartCard}>
                <Text style={styles.cardTitle}>{t("stats.heatmapTitle")}</Text>
                <Text style={styles.cardCaption}>{t("stats.heatmapCaption")}</Text>
                <View style={styles.heatmapGrid}>
                  {heatmapDays.map((d) => (
                    <View
                      key={d.date}
                      style={[styles.heatCell, { backgroundColor: heatmapCellColor(d.intensity) }]}
                    />
                  ))}
                </View>
                <ActivityHeatmapLegend />
              </AppCard>
            ) : null}

            {!showInitialLoading ? (
              <AppCard style={styles.chartCard}>
                <Text style={styles.cardTitle}>{t("stats.perDayTitle")}</Text>
                <Text style={styles.cardCaption}>{t("stats.perDayChartHint")}</Text>
                {chartData.length === 0 ? (
                  <Text style={styles.emptyText}>{t("stats.perDayEmpty")}</Text>
                ) : (
                  <View style={styles.chartInner}>
                    <SessionsPerDayChart data={chartData} />
                  </View>
                )}
              </AppCard>
            ) : null}

            {!showInitialLoading ? (
              <AppCard style={styles.chartCard}>
                <Text style={styles.cardTitle}>{t("stats.typeMixTitle")}</Text>
                {breakdownData.length > 0 ? (
                  <View style={styles.breakdownWrap}>
                    {breakdownData.map((item) => (
                      <View key={item.label} style={styles.breakdownRow}>
                        <View style={styles.breakdownLabelWrap}>
                          <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                          <Text style={styles.breakdownLabel}>{item.label}</Text>
                        </View>
                        <View style={styles.breakdownTrack}>
                          <View
                            style={[
                              styles.breakdownFill,
                              { width: `${item.value}%`, backgroundColor: item.color },
                            ]}
                          />
                        </View>
                        <Text style={styles.breakdownValue}>
                          {item.sessions} · {item.value}%
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyText}>{t("stats.typeMixEmpty")}</Text>
                  </View>
                )}
              </AppCard>
            ) : null}

            {!showInitialLoading && productivityHintText ? (
              <AppCard style={styles.hintCard}>
                <Text style={styles.hintText}>{productivityHintText}</Text>
              </AppCard>
            ) : null}

            {!showInitialLoading ? (
              <ProgressionBarCard
                progression={progression}
                onPress={() => router.push(progressionOverviewHref("stats"))}
              />
            ) : null}

            {!showInitialLoading ? (
              <Text style={styles.recentTitle}>{t("stats.recentTitle")}</Text>
            ) : null}
            {!showInitialLoading && recent.length === 0 ? (
              <Text style={styles.emptyText}>{t("stats.recentEmpty")}</Text>
            ) : !showInitialLoading ? (
              <View style={styles.recentList}>
                {recent.map((item) => (
                  <View
                    key={`top-${typeof item.id === "number" && item.id > 0 ? item.id : `r-${item.started_at}`}`}
                    style={styles.recentItem}
                  >
                    {renderRecent({ item })}
                  </View>
                ))}
              </View>
            ) : null}

            {false && !showInitialLoading ? (
              <AppCard style={styles.chartCard}>
                <Text style={styles.cardTitle}>{t("stats.recordsTitle")}</Text>
                {decoratedRecords.length === 0 ? (
                  <Text style={styles.emptyText}>{t("stats.recordsEmpty")}</Text>
                ) : (
                  <View style={styles.recordsWrap}>
                    {decoratedRecords.slice(0, 3).map((r, idx) => {
                      const meta = formatRecordDate(r.occurred_at, t);
                      const displayContext = formatRecordContext(r, t);
                      return (
                        <View
                          key={r.key + (r.occurred_at ?? "")}
                          style={[styles.recordCard, idx === 0 && styles.recordCardFeatured]}
                        >
                          <View style={styles.recordTitleRow}>
                            <View style={styles.recordLabelWrap}>
                              <RecordGlyph recordKey={r.key} size={16} />
                              <Text style={styles.recordLabel}>
                                {recordTitle(r.key, r.label, t)}
                              </Text>
                            </View>
                            <View style={styles.recordBadgesRow}>
                              {r.isFresh ? (
                                <View style={[styles.recordBadge, styles.recordBadgeFresh]}>
                                  <Text
                                    style={[styles.recordBadgeText, styles.recordBadgeTextFresh]}
                                  >
                                    {t("stats.recordFresh")}
                                  </Text>
                                </View>
                              ) : null}
                              {idx === 0 ? (
                                <View style={styles.recordBadge}>
                                  <Text style={styles.recordBadgeText}>
                                    {t("stats.recordBest")}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <Text style={styles.recordVal}>{r.value}</Text>
                          {displayContext ? (
                            <Text style={styles.recordCtx}>{displayContext}</Text>
                          ) : null}
                          {meta ? <Text style={styles.recordMeta}>{meta}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </AppCard>
            ) : null}

            {false && !showInitialLoading ? (
              <Text style={styles.recentTitle}>{t("stats.recentTitle")}</Text>
            ) : null}

            {!showInitialLoading ? (
              <View style={styles.weeklyRecapBottomCta}>
                <SecondaryButton
                  label={t("stats.openWeeklyRecap")}
                  onPress={() => router.push("/weekly-recap")}
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
  skeletonWrap: {
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  skeletonStatCard: {
    width: 162,
    gap: spacing.sm,
  },
  skeletonBlockCard: {
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  skeletonLabel: {
    width: "46%",
  },
  skeletonValue: {
    width: "62%",
    height: 24,
    backgroundColor: "rgba(255,255,255,0.11)",
  },
  skeletonSub: {
    width: "55%",
  },
  skeletonTitle: {
    width: "40%",
  },
  skeletonBody: {
    width: "100%",
  },
  skeletonBodyShort: {
    width: "72%",
  },
  inlineLoadingRow: {
    marginBottom: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  inlineLoadingText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.screenTitle },
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
  cardRow: { gap: spacing.sm, paddingBottom: spacing.lg },
  contentFadeWrap: {
    gap: spacing.lg,
  },
  motivationWrap: {
    marginBottom: spacing.lg,
  },
  goalCard: {
    marginBottom: spacing.lg,
  },
  goalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  goalTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  goalSub: { color: colors.textSecondary, marginTop: 4, ...typography.meta },
  goalProgressTrack: {
    marginTop: spacing.sm,
    width: "100%",
    height: 8,
    borderRadius: radii.round,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  goalProgressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  goalSubtle: { color: colors.textSecondary, marginTop: spacing.sm, ...typography.meta },
  forecastBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  forecastRiskPill: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.round,
    ...typography.meta,
    fontFamily: fontFamily.bodyBold,
  },
  forecastRiskOnTrack: {
    color: colors.success,
    backgroundColor: "rgba(34,197,94,0.15)",
  },
  forecastRiskAtRisk: {
    color: colors.primary,
    backgroundColor: "rgba(255,61,0,0.15)",
  },
  forecastRiskOffTrack: {
    color: colors.danger,
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  forecastProgressLine: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
    marginTop: spacing.xs,
  },
  forecastWarning: {
    color: colors.textPrimary,
    marginTop: spacing.sm,
    ...typography.meta,
    lineHeight: 20,
    fontFamily: fontFamily.bodyMedium,
  },
  chartCard: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.cardTitle,
  },
  cardCaption: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
    lineHeight: 18,
    marginTop: 4,
  },
  heatmapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginTop: spacing.sm,
  },
  heatCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  recordsWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  recordCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: 6,
  },
  recordCardFeatured: {
    borderColor: "rgba(255,61,0,0.5)",
    backgroundColor: "rgba(255,61,0,0.08)",
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  recordTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  recordLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  statValueText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  recordBadge: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(255,61,0,0.2)",
  },
  recordBadgeFresh: {
    backgroundColor: "rgba(162,89,255,0.2)",
  },
  recordBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  recordLabel: {
    color: colors.textSecondary,
    ...typography.meta,
    fontFamily: fontFamily.bodyMedium,
    flexShrink: 1,
  },
  recordBadgeText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
  },
  recordBadgeTextFresh: {
    color: colors.secondary,
  },
  recordVal: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 24,
    lineHeight: 30,
  },
  recordCtx: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  recordMeta: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
  },
  chartInner: { marginTop: spacing.xs },
  barScrollContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: spacing.xs,
    paddingBottom: 2,
    paddingRight: spacing.sm,
  },
  barColumn: {
    width: 40,
    alignItems: "center",
  },
  barTrack: {
    height: BAR_CHART_HEIGHT,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barFill: {
    width: 24,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  barAxisLabel: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: fontFamily.body,
    maxWidth: 40,
    textAlign: "center",
  },
  barCount: {
    marginTop: 1,
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: fontFamily.bodyMedium,
  },
  breakdownWrap: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    width: 132,
    gap: spacing.xs,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    flexShrink: 1,
  },
  breakdownTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#222222",
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: 5,
  },
  breakdownValue: {
    color: colors.textSecondary,
    width: 72,
    textAlign: "right",
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  errorText: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  emptyWrap: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  hintCard: {
    marginBottom: spacing.lg,
    backgroundColor: "rgba(162,89,255,0.12)",
    borderColor: colors.secondary,
  },
  hintText: { color: colors.textSecondary, ...typography.meta, lineHeight: 20 },
  recentTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.sectionTitle,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  recentRowPressed: {
    opacity: motion.pressOpacity,
    transform: [{ scale: motion.pressScale }],
    borderColor: "rgba(255,255,255,0.16)",
  },
  recentType: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  recentMid: { alignItems: "flex-end", marginRight: spacing.md },
  recentDur: { color: colors.textPrimary, ...typography.meta },
  recentDate: { color: colors.textSecondary, ...typography.meta, marginTop: 2 },
  recentChev: { color: colors.primary, fontSize: 20, marginLeft: spacing.xs },
  recentList: {
    marginBottom: spacing.md,
  },
  recentItem: {
    marginBottom: spacing.md,
  },
  weeklyRecapBottomCta: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
