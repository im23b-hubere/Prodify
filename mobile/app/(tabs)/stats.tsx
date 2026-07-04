import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { YourWeekCard } from "../../components/stats/YourWeekCard";
import { StatsKpiStrip } from "../../components/stats/StatsKpiStrip";
import { AppFlame, RecordGlyph, glyphRowStyle } from "../../components/icons/ProdifyGlyphs";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { EmptyState } from "../../components/states/EmptyState";
import { AppCard } from "../../components/ui/AppCard";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { ProgressionBarCard } from "../../components/progression/ProgressionBarCard";
import { RankHudChip } from "../../components/progression/RankHudChip";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { fontFamily } from "../../constants/fonts";
import { WEEKLY_GOAL_CONFIGURED_KEY } from "../../constants/storageKeys";
import { colors, motion, radii, spacing, typography, ui } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { fetchCurrentGoal, setWeeklyGoal as saveWeeklyGoalApi } from "../../lib/goals";
import { fetchCommitment } from "../../lib/social";
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
import { isScreenDataStale } from "../../lib/screenDataStale";
import { fetchProgression, syncProgression } from "../../lib/progressionSync";
import { ActivityHeatmapLegend } from "../../components/charts/ActivityHeatmapLegend";
import { heatmapCellColor } from "../../lib/heatmapStyle";
import { tryParseGoalForecastDto } from "../../lib/outcomesDto";
import {
  tryParseHeatmapDays,
  tryParsePersonalRecords,
  tryParseSessionStatsDto,
} from "../../lib/statsDto";
import type { CommitmentDto } from "../../types/friends";
import type { GoalCurrentDto } from "../../types/goals";
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

function StatsSection({
  title,
  subtitle,
  testID,
  children,
}: {
  title: string;
  subtitle?: string | null;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <AppCard style={styles.staticSection} testID={testID}>
      <View style={styles.staticSectionHeader}>
        <Text style={styles.staticSectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.staticSectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.staticSectionBody}>{children}</View>
    </AppCard>
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
  const params = useLocalSearchParams<{ focus?: string | string[] }>();
  const focusParam = Array.isArray(params.focus) ? params.focus[0] : params.focus;
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
  const [weeklyGoal, setWeeklyGoal] = useState<GoalCurrentDto | null>(null);
  const [commitment, setCommitment] = useState<CommitmentDto | null>(null);
  const [goalConfigured, setGoalConfigured] = useState(false);
  const [weekBusy, setWeekBusy] = useState(false);
  const [progression, setProgression] = useState<ProgressionDto | null>(null);
  const [serverMotivationDto, setServerMotivationDto] = useState<MotivationalMessageDto | null>(
    null,
  );
  const loadSeq = useRef(0);
  const mounted = useRef(true);
  const lastStatsFetchRef = useRef<{ at: number; period: string } | null>(null);
  const lastPeriodParamRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const yourWeekOffsetY = useRef(0);
  const pendingYourWeekFocus = useRef(false);
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
    async (opts: { force?: boolean; forceProgressionSync?: boolean } = {}) => {
      const force = Boolean(opts.force);
      const forceProgressionSync = Boolean(opts.forceProgressionSync);
      if (!token) return;

      const lastFetch = lastStatsFetchRef.current;
      if (
        !force &&
        !forceProgressionSync &&
        lastFetch &&
        lastFetch.period === periodParam &&
        !isScreenDataStale(lastFetch.at)
      ) {
        return;
      }

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

        const [progressionRes, motivationRes, goalRes, commitmentRes, configuredRes, forecastRes] =
          await Promise.allSettled([
            forceProgressionSync
              ? syncProgression(token, { force: true })
              : fetchProgression(token),
            apiJson<unknown>("/motivational-messages/random", { token }),
            fetchCurrentGoal(token),
            fetchCommitment(token),
            AsyncStorage.getItem(WEEKLY_GOAL_CONFIGURED_KEY),
            apiJson<unknown>("/outcomes/goal-forecast/current", { token }),
          ]);
        if (!mounted.current || seq !== loadSeq.current) return;

        const progressionRaw = progressionRes.status === "fulfilled" ? progressionRes.value : null;
        const motivationRaw = motivationRes.status === "fulfilled" ? motivationRes.value : null;
        const goalRaw = goalRes.status === "fulfilled" ? goalRes.value : null;
        const commitmentRaw = commitmentRes.status === "fulfilled" ? commitmentRes.value : null;
        const configuredRaw = configuredRes.status === "fulfilled" ? configuredRes.value : null;
        const forecastRaw = forecastRes.status === "fulfilled" ? forecastRes.value : null;

        if (mounted.current && seq === loadSeq.current) {
          setForecast(forecastRaw ? tryParseGoalForecastDto(forecastRaw) : null);
        }
        setWeeklyGoal(goalRaw);
        setCommitment(commitmentRaw);
        const hasConfiguredFlag = configuredRaw === "1";
        const hasWeekActivity = (goalRaw?.current_sessions ?? 0) > 0;
        const isConfigured = hasConfiguredFlag || hasWeekActivity;
        setGoalConfigured(isConfigured);
        if (isConfigured && !hasConfiguredFlag) {
          void AsyncStorage.setItem(WEEKLY_GOAL_CONFIGURED_KEY, "1");
        }
        setProgression(progressionRaw);
        setServerMotivationDto(parseMotivationalMessage(motivationRaw));
        lastStatsFetchRef.current = { at: Date.now(), period: periodParam };
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

  const onRefresh = useCallback(async () => {
    if (mounted.current) setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await loadStats({ force: true, forceProgressionSync: true }).catch((e) => {
      if (mounted.current) setError(e instanceof Error ? e.message : t("stats.loadFailed"));
    });
    if (mounted.current) setRefreshing(false);
  }, [loadStats, t]);

  const handleSaveWeeklyGoal = useCallback(
    async (target: number, shareWithFriends: boolean) => {
      if (!token) return;
      setWeekBusy(true);
      try {
        const updated = await saveWeeklyGoalApi(token, target);
        setWeeklyGoal(updated);
        await AsyncStorage.setItem(WEEKLY_GOAL_CONFIGURED_KEY, "1").catch(() => undefined);
        setGoalConfigured(true);
        if (shareWithFriends) {
          await apiJson("/social/commitment", {
            token,
            method: "POST",
            body: {
              target_sessions: target,
              visibility: "friends",
              commitment_key: "sessions",
              period_days: 7,
              witness_user_ids: [],
            },
          });
          const nextCommitment = await fetchCommitment(token);
          setCommitment(nextCommitment);
        }
        const nextForecastRaw = await apiJson<unknown>("/outcomes/goal-forecast/current", {
          token,
        }).catch(() => null);
        setForecast(nextForecastRaw ? tryParseGoalForecastDto(nextForecastRaw) : null);
      } finally {
        setWeekBusy(false);
      }
    },
    [token],
  );

  const handleStartSession = useCallback(() => {
    router.push("/session/setup" as Href);
  }, [router]);

  const openWeeklyRecap = useCallback(() => {
    router.push("/weekly-recap");
  }, [router]);

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

  const recent = useMemo(() => stats?.recent_sessions ?? [], [stats?.recent_sessions]);

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
            <AppFlame size={16} />
            <Text style={styles.statValueText}>{summary.streak}</Text>
          </View>
        ),
        sublabel: t("stats.bestStreakSub", { days: summary.bestStreak }),
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
        ref={scrollRef}
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
          <ScreenHeader title={t("stats.title")} actionNode={<RankHudChip from="stats" />} />
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
          <Text style={styles.filterHint}>{t("stats.filterScopeShort")}</Text>
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
                <YourWeekCard
                  t={t}
                  goal={weeklyGoal}
                  forecast={forecast}
                  commitment={commitment}
                  heatmapDays={heatmapDays}
                  configured={goalConfigured}
                  busy={weekBusy}
                  hero
                  onSaveGoal={handleSaveWeeklyGoal}
                  onStartSession={handleStartSession}
                />
              </View>
            ) : null}

            <StatsKpiStrip items={statCarouselItems} testID="stats-kpi-strip" />

            {productivityHintText ? (
              <AppCard style={styles.hintCard} testID="stats-ai-insight">
                <Text style={styles.hintLabel}>{t("stats.aiInsightLabel")}</Text>
                <Text style={styles.hintText}>{productivityHintText}</Text>
              </AppCard>
            ) : null}

            {token ? (
              <View style={styles.motivationWrap} testID="stats-section-motivation">
                <Text style={styles.sectionGroupTitle}>{t("stats.motivationSectionTitle")}</Text>
                <DashboardMotivationCard
                  greeting={getTimeBasedGreeting()}
                  userName={user?.username ?? t("dashboard.defaultUserName")}
                  message={motivationMessage}
                  serverMessage={serverMotivationLine}
                  todaySessionCount={todaySessionCount}
                />
              </View>
            ) : null}

            <Text style={styles.sectionGroupTitle}>{t("stats.sectionInsights")}</Text>

            <StatsSection
              title={t("stats.trendsSectionTitle")}
              subtitle={t("stats.trendsSectionSubtitle")}
              testID="stats-section-trends"
            >
              <View style={styles.nestedBlock}>
                <Text style={styles.nestedTitle}>{t("stats.perDayTitle")}</Text>
                {chartData.length === 0 ? (
                  <EmptyState
                    compact
                    title={t("stats.perDayEmptyTitle")}
                    message={t("stats.perDayEmpty")}
                    actionLabel={t("common.startSession")}
                    onAction={handleStartSession}
                  />
                ) : (
                  <View style={styles.chartInner}>
                    <SessionsPerDayChart data={chartData} />
                  </View>
                )}
              </View>
              <View style={styles.nestedBlock}>
                <Text style={styles.nestedTitle}>{t("stats.typeMixTitle")}</Text>
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
                  <EmptyState
                    compact
                    title={t("stats.typeMixEmptyTitle")}
                    message={t("stats.typeMixEmpty")}
                    actionLabel={t("common.startSession")}
                    onAction={handleStartSession}
                  />
                )}
              </View>
            </StatsSection>

            <View style={styles.recentBlock} testID="stats-section-recent">
              <Text style={styles.recentTitle}>{t("stats.recentTitle")}</Text>
              {recent.length === 0 ? (
                <EmptyState
                  compact
                  title={t("stats.recentEmptyTitle")}
                  message={t("stats.recentEmpty")}
                  actionLabel={t("common.startSession")}
                  onAction={handleStartSession}
                />
              ) : (
                <View style={styles.recentList}>
                  {recent.slice(0, 5).map((item) => (
                    <View
                      key={`top-${typeof item.id === "number" && item.id > 0 ? item.id : `r-${item.started_at}`}`}
                      style={styles.recentItem}
                    >
                      {renderRecent({ item })}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.sectionGroupTitle}>{t("stats.sectionHistory")}</Text>

            <StatsSection
              title={t("stats.heatmapTitle")}
              subtitle={t("stats.heatmapCaptionShort")}
              testID="stats-section-heatmap"
            >
              <View style={styles.heatmapGrid}>
                {heatmapDays.map((d) => (
                  <View
                    key={d.date}
                    style={[styles.heatCell, { backgroundColor: heatmapCellColor(d.intensity) }]}
                  />
                ))}
              </View>
              <ActivityHeatmapLegend />
            </StatsSection>

            <StatsSection
              title={t("stats.recordsTitle")}
              subtitle={
                decoratedRecords.length > 0
                  ? decoratedRecords[0]?.value
                  : t("stats.recordsEmpty")
              }
              testID="stats-section-records"
            >
              {decoratedRecords.length === 0 ? (
                <EmptyState
                  compact
                  title={t("stats.recordsEmptyTitle")}
                  message={t("stats.recordsEmpty")}
                  actionLabel={t("common.startSession")}
                  onAction={handleStartSession}
                />
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
                                <Text style={styles.recordBadgeText}>{t("stats.recordBest")}</Text>
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
            </StatsSection>

            <Text style={styles.sectionGroupTitle}>{t("stats.sectionExtras")}</Text>

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

            <View style={styles.weeklyRecapBottomCta}>
              <SecondaryButton label={t("stats.openWeeklyRecap")} onPress={openWeeklyRecap} />
            </View>
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
    gap: spacing.md,
  },
  motivationWrap: {
    marginBottom: spacing.xs,
  },
  heroWrap: {
    marginBottom: spacing.xs,
  },
  sectionGroupTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: spacing.xs,
  },
  nestedBlock: {
    gap: spacing.sm,
  },
  staticSection: {
    gap: spacing.md,
  },
  staticSectionHeader: {
    gap: 4,
  },
  staticSectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  staticSectionSubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    lineHeight: 18,
  },
  staticSectionBody: {
    gap: spacing.sm,
  },
  nestedTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  recentBlock: {
    gap: spacing.sm,
  },
  progressionInner: {
    marginTop: -spacing.md,
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
    gap: spacing.sm,
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
  recentTitle: {
    marginBottom: spacing.xs,
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
    marginBottom: spacing.xs,
  },
  recentItem: {
    marginBottom: spacing.sm,
  },
  weeklyRecapBottomCta: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
});
