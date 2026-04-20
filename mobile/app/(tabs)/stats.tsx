import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/states/EmptyState";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { AppCard } from "../../components/ui/AppCard";
import { StatCard } from "../../components/ui/StatCard";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, motion, radii, spacing, typography, ui } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { debugLog } from "../../lib/debugLog";
import { formatSessionListDate, weekdayLetterFromIsoDay } from "../../lib/sessionTime";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { translateInsightItem } from "../../lib/sessionInsightsI18n";
import { tryParseGoalForecastDto, tryParseProgressionDto } from "../../lib/outcomesDto";
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

type CalendarMode = "week" | "month";
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

function recordIcon(key: string) {
  if (key === "longest_session") return "⏱";
  if (key === "most_sessions_day") return "📅";
  if (key === "longest_streak") return "🔥";
  if (key === "current_streak") return "⚡";
  if (key === "productive_week") return "🏆";
  return "⭐";
}

function recordPriorityScore(key: string) {
  if (key === "current_streak") return 100;
  if (key === "longest_streak") return 90;
  if (key === "productive_week") return 80;
  if (key === "most_sessions_day") return 70;
  if (key === "longest_session") return 60;
  return 20;
}

const BAR_CHART_HEIGHT = 168;

type BarPoint = { x: string; y: number; label: string };

function SessionsPerDayChart({ data }: { data: BarPoint[] }) {
  const maxY = Math.max(1, ...data.map((d) => d.y));
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled={Platform.OS === "android"}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.barScrollContent}
    >
      {data.map((d, i) => {
        const h = Math.max(3, (d.y / maxY) * BAR_CHART_HEIGHT);
        const isToday = d.label === todayIso;
        return (
          <View key={`${d.label}-${i}`} style={styles.barColumn}>
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
      })}
    </ScrollView>
  );
}

export default function StatsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
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
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const loadSeq = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadSeq.current += 1;
    };
  }, []);

  const periodParam =
    filter.period === "week" ? "week" : filter.period === "month" ? "month" : "all";

  const loadStats = useCallback(async () => {
    if (!token) return;
    const seq = ++loadSeq.current;
    if (mounted.current) setLoading(true);
    if (mounted.current) setError(null);
    try {
      const [rawStats, rawHm, rawRec, progressionRaw] = await Promise.all([
        apiJson<unknown>(`/sessions/stats?period=${periodParam}`, { token }),
        apiJson<unknown>(`/stats/heatmap`, { token }),
        apiJson<unknown>(`/stats/records`, { token }),
        apiJson<unknown>("/progression/sync", { token, method: "POST", body: {} }).catch(
          () => null,
        ),
      ]);
      const forecastRaw = await apiJson<unknown>("/outcomes/goal-forecast/current", {
        token,
      }).catch(() => null);
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
        setForecast(forecastRaw ? tryParseGoalForecastDto(forecastRaw) : null);
        setProgression(progressionRaw ? tryParseProgressionDto(progressionRaw) : null);
      }
    } catch (e) {
      if (!mounted.current || seq !== loadSeq.current) return;
      const msg = e instanceof Error ? e.message : t("stats.loadFailed");
      debugLog("stats", "stats_fetch_failed", { period: periodParam, message: msg });
      if (mounted.current) setError(msg);
    } finally {
      if (!mounted.current || seq !== loadSeq.current) return;
      setLoading(false);
    }
  }, [periodParam, token, t]);

  useEffect(() => {
    loadStats().catch((e) => setError(e instanceof Error ? e.message : t("stats.loadFailed")));
  }, [loadStats, t]);

  useFocusEffect(
    useCallback(() => {
      loadStats().catch(() => undefined);
    }, [loadStats]),
  );

  const onRefresh = useCallback(async () => {
    if (mounted.current) setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await loadStats().catch((e) => {
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

  const heatmapByDate = useMemo(() => {
    const map = new Map<string, HeatmapDay>();
    for (const day of heatmapDays) map.set(day.date, day);
    return map;
  }, [heatmapDays]);

  const weekCalendarDays = useMemo(() => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekOffset * 7);
    const start = new Date(end.getTime() - 6 * CALENDAR_DAY_MS);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start.getTime() + i * CALENDAR_DAY_MS);
      const key = date.toISOString().slice(0, 10);
      const data = heatmapByDate.get(key);
      return {
        key,
        date,
        dayName: date.toLocaleDateString(undefined, { weekday: "short" }),
        dayNum: date.getDate(),
        seconds: data?.seconds ?? 0,
        intensity: data?.intensity ?? 0,
      };
    });
  }, [heatmapByDate, weekOffset]);

  const monthCalendarDays = useMemo(() => {
    const base = new Date();
    const monthDate = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthLabel = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const firstWeekday = (monthDate.getDay() + 6) % 7; // Monday=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const entries: {
      key: string;
      dayNum: number | null;
      seconds: number;
      intensity: number;
      inMonth: boolean;
    }[] = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      entries.push({ key: `blank-${i}`, dayNum: null, seconds: 0, intensity: 0, inMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(year, month, day);
      const key = d.toISOString().slice(0, 10);
      const info = heatmapByDate.get(key);
      entries.push({
        key,
        dayNum: day,
        seconds: info?.seconds ?? 0,
        intensity: info?.intensity ?? 0,
        inMonth: true,
      });
    }

    while (entries.length % 7 !== 0) {
      entries.push({
        key: `tail-${entries.length}`,
        dayNum: null,
        seconds: 0,
        intensity: 0,
        inMonth: false,
      });
    }

    return { monthLabel, entries };
  }, [heatmapByDate, monthOffset]);

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
        const isoLabel = date.toISOString().slice(0, 10);
        return {
          x: weekdayLetterFromIsoDay(isoLabel),
          y: sessionsByDay.get(isoLabel) ?? 0,
          label: isoLabel,
        };
      });
    }
    if (points.length === 0) return [{ x: "—", y: 0, label: "-" }];
    return points.map((p) => ({
      x: weekdayLetterFromIsoDay(p.label),
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
  const levelProgressPercent = Math.max(0, Math.min(100, progression?.progress_percent ?? 0));

  const weekGoal = useMemo(() => {
    if (filter.period !== "week" || !stats?.trend?.length) return null;
    const daysWith = new Set(stats.trend.map((t) => t.label).filter(Boolean)).size;
    return { daysWith, goal: 7 };
  }, [filter.period, stats?.trend]);

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
          <ScreenHeader
            title={t("stats.title")}
            subtitle={t("stats.filterAll")}
            actionLabel={t("sessionFeedback.backToDashboard")}
            onActionPress={() => router.push("/(tabs)/dashboard")}
          />
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
        </View>
        <View style={styles.quickActions}>
          <PrimaryButton
            label={t("dashboard.startSession")}
            onPress={() => router.push("/session/setup")}
          />
          <SecondaryButton
            label={t("sessionFeedback.backToDashboard")}
            onPress={() => router.push("/(tabs)/dashboard")}
          />
        </View>
        {loading && !refreshing ? <LoadingState message={t("stats.loading")} /> : null}
        {!loading && error ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("common.tryAgain")}
            onRetry={() => loadStats().catch(() => undefined)}
          />
        ) : null}
        {!loading && !error && recent.length === 0 ? (
          <EmptyState icon="📊" title={t("stats.recentTitle")} message={t("stats.recentEmpty")} />
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={172}
          decelerationRate="fast"
          contentContainerStyle={styles.cardRow}
        >
          <StatCard
            label={t("stats.totalHours")}
            value={summary.hours}
            sublabel={
              summary.delta != null
                ? t("stats.vsPrior", {
                    sign: summary.delta >= 0 ? "+" : "",
                    hours: summary.delta,
                  })
                : undefined
            }
            subPositive={summary.delta == null || summary.delta >= 0}
          />
          <StatCard label={t("stats.sessions")} value={summary.sessions} />
          <StatCard
            label={t("stats.currentStreak")}
            value={`🔥 ${summary.streak}`}
            sublabel={t("stats.bestStreakSub", { days: summary.bestStreak })}
          />
        </ScrollView>

        {progression ? (
          <AppCard style={styles.progressionCard}>
            <View style={styles.progressionTopRow}>
              <Text style={styles.cardTitle}>
                {t("progression.levelTitle", { level: progression.current_level })}
              </Text>
              <Text style={styles.goalSubtle}>
                {t("progression.xpTotal", { xp: progression.xp_total })}
              </Text>
            </View>
            <View style={styles.progressionTrack}>
              <View style={[styles.progressionFill, { width: `${levelProgressPercent}%` }]} />
            </View>
            <Text style={styles.goalSubtle}>
              {t("progression.toNext", {
                xp: progression.xp_to_next_level,
                level: progression.current_level + 1,
                percent: Math.round(levelProgressPercent),
              })}
            </Text>
            <View style={styles.progressionButtonRow}>
              <SecondaryButton
                label={t("progression.openOverview")}
                onPress={() => router.push("/progression-overview")}
              />
            </View>
          </AppCard>
        ) : null}

        {weekGoal || forecast ? (
          <AppCard style={styles.goalCard}>
            {weekGoal ? (
              <>
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
              </>
            ) : null}
            {forecast ? <Text style={styles.goalSubtle}>{forecast.warning_message}</Text> : null}
          </AppCard>
        ) : null}

        <AppCard style={styles.chartCard}>
          <Text style={styles.cardTitle}>{t("stats.heatmapTitle")}</Text>
          <View style={styles.heatmapGrid}>
            {heatmapDays.map((d) => (
              <View
                key={d.date}
                style={[
                  styles.heatCell,
                  {
                    opacity: 0.25 + d.intensity * 0.18,
                    backgroundColor:
                      d.intensity === 0
                        ? "#1e1e1e"
                        : d.intensity < 3
                          ? colors.primary
                          : colors.secondary,
                  },
                ]}
              />
            ))}
          </View>
        </AppCard>

        <AppCard style={styles.chartCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.cardTitle}>{t("stats.activityCalendarTitle")}</Text>
            <View style={styles.calendarModeRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.modeChip,
                  calendarMode === "week" && styles.modeChipActive,
                  pressed && styles.modeChipPressed,
                ]}
                onPress={() => setCalendarMode("week")}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    calendarMode === "week" && styles.modeChipTextActive,
                  ]}
                >
                  {t("stats.calendarWeek")}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modeChip,
                  calendarMode === "month" && styles.modeChipActive,
                  pressed && styles.modeChipPressed,
                ]}
                onPress={() => setCalendarMode("month")}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    calendarMode === "month" && styles.modeChipTextActive,
                  ]}
                >
                  {t("stats.calendarMonth")}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.calendarNavRow}>
            <Pressable
              style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
              onPress={() => {
                if (calendarMode === "week") setWeekOffset((prev) => prev + 1);
                else setMonthOffset((prev) => prev - 1);
              }}
            >
              <Text style={styles.navBtnText}>{t("stats.calendarPrev")}</Text>
            </Pressable>
            <Text style={styles.calendarRangeLabel}>
              {calendarMode === "week"
                ? t("stats.calendarWeekRange", {
                    start: weekCalendarDays[0]?.date.toLocaleDateString(),
                    end: weekCalendarDays[6]?.date.toLocaleDateString(),
                  })
                : monthCalendarDays.monthLabel}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
              disabled={calendarMode === "week" ? weekOffset === 0 : monthOffset === 0}
              onPress={() => {
                if (calendarMode === "week") setWeekOffset((prev) => Math.max(0, prev - 1));
                else setMonthOffset((prev) => Math.min(0, prev + 1));
              }}
            >
              <Text
                style={[
                  styles.navBtnText,
                  (calendarMode === "week" ? weekOffset === 0 : monthOffset === 0) &&
                    styles.navBtnTextDisabled,
                ]}
              >
                {t("stats.calendarNext")}
              </Text>
            </Pressable>
          </View>

          {calendarMode === "week" ? (
            <View style={styles.weekGrid}>
              {weekCalendarDays.map((day) => (
                <View key={day.key} style={styles.weekDayCell}>
                  <Text style={styles.weekDayLabel}>{day.dayName.slice(0, 1)}</Text>
                  <View
                    style={[
                      styles.weekDayDot,
                      day.intensity > 0 && styles.weekDayDotActive,
                      day.intensity > 2 && styles.weekDayDotStrong,
                    ]}
                  />
                  <Text style={styles.weekDayNum}>{day.dayNum}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.monthGrid}>
              {monthCalendarDays.entries.map((entry) => (
                <View
                  key={entry.key}
                  style={[
                    styles.monthCell,
                    !entry.inMonth && styles.monthCellMuted,
                    entry.intensity > 0 && styles.monthCellActive,
                    entry.intensity > 2 && styles.monthCellStrong,
                  ]}
                >
                  <Text style={[styles.monthCellText, !entry.inMonth && styles.monthCellTextMuted]}>
                    {entry.dayNum ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </AppCard>

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
                  <Pressable
                    key={r.key + (r.occurred_at ?? "")}
                    style={({ pressed }) => [
                      styles.recordCard,
                      idx === 0 && styles.recordCardFeatured,
                      pressed && styles.recordCardPressed,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                    }}
                  >
                    <View style={styles.recordTitleRow}>
                      <View style={styles.recordLabelWrap}>
                        <Text style={styles.recordIcon}>{recordIcon(r.key)}</Text>
                        <Text style={styles.recordLabel}>{recordTitle(r.key, r.label, t)}</Text>
                      </View>
                      <View style={styles.recordBadgesRow}>
                        {r.isFresh ? (
                          <View style={[styles.recordBadge, styles.recordBadgeFresh]}>
                            <Text style={[styles.recordBadgeText, styles.recordBadgeTextFresh]}>
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
                    {displayContext ? <Text style={styles.recordCtx}>{displayContext}</Text> : null}
                    {meta ? <Text style={styles.recordMeta}>{meta}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </AppCard>

        <AppCard style={styles.chartCard}>
          <Text style={styles.cardTitle}>{t("stats.perDayTitle")}</Text>
          {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.chartInner}>
            <SessionsPerDayChart data={chartData} />
          </View>
        </AppCard>

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

        {productivityHintText ? (
          <AppCard style={styles.hintCard}>
            <Text style={styles.hintText}>{productivityHintText}</Text>
          </AppCard>
        ) : null}

        <Text style={styles.recentTitle}>{t("stats.recentTitle")}</Text>
        {recent.length === 0 ? (
          <Text style={styles.emptyText}>{t("stats.recentEmpty")}</Text>
        ) : (
          <View style={styles.recentList}>
            {recent.map((item) => (
              <View
                key={typeof item.id === "number" && item.id > 0 ? item.id : `r-${item.started_at}`}
                style={styles.recentItem}
              >
                {renderRecent({ item })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: ui.screenPadding, paddingBottom: spacing.xxl },
  headerRow: { marginBottom: spacing.md, gap: spacing.sm },
  quickActions: {
    marginBottom: spacing.md,
    gap: spacing.sm,
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
  goalCard: {
    marginBottom: spacing.lg,
  },
  goalTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  goalSub: { color: colors.textSecondary, marginTop: 4, ...typography.meta },
  goalSubtle: { color: colors.textSecondary, marginTop: spacing.sm, ...typography.meta },
  progressionCard: {
    marginBottom: spacing.lg,
  },
  progressionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  progressionTrack: {
    marginTop: spacing.sm,
    width: "100%",
    height: 8,
    borderRadius: radii.round,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  progressionFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  progressionButtonRow: {
    marginTop: spacing.xs,
  },
  chartCard: {
    marginBottom: spacing.lg,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  calendarModeRow: { flexDirection: "row", gap: spacing.xs },
  modeChip: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  modeChipActive: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.16)" },
  modeChipPressed: { opacity: motion.pressOpacity, transform: [{ scale: motion.pressScale }] },
  modeChipText: {
    color: colors.textSecondary,
    ...typography.meta,
    fontFamily: fontFamily.bodyMedium,
  },
  modeChipTextActive: { color: colors.textPrimary },
  calendarNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  navBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  navBtnPressed: { opacity: motion.pressOpacity, transform: [{ scale: motion.pressScale }] },
  navBtnText: { color: colors.textPrimary, ...typography.meta, fontFamily: fontFamily.bodyBold },
  navBtnTextDisabled: { color: colors.textSecondary },
  calendarRangeLabel: {
    flex: 1,
    textAlign: "center",
    color: colors.textSecondary,
    ...typography.meta,
  },
  weekGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  weekDayCell: { width: "13.5%", alignItems: "center", gap: 4 },
  weekDayLabel: {
    color: colors.textSecondary,
    ...typography.meta,
    fontFamily: fontFamily.bodyMedium,
  },
  weekDayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  weekDayDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  weekDayDotStrong: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  weekDayNum: { color: colors.textSecondary, fontSize: 11 },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.xs,
  },
  monthCell: {
    width: "13.4%",
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  monthCellMuted: {
    opacity: 0.35,
  },
  monthCellActive: {
    backgroundColor: "rgba(255,61,0,0.14)",
    borderColor: "rgba(255,61,0,0.35)",
  },
  monthCellStrong: {
    backgroundColor: "rgba(162,89,255,0.2)",
    borderColor: "rgba(162,89,255,0.5)",
  },
  monthCellText: {
    color: colors.textPrimary,
    ...typography.meta,
    fontFamily: fontFamily.bodyMedium,
  },
  monthCellTextMuted: { color: colors.textSecondary },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.cardTitle,
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
  recordCardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
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
  recordIcon: {
    fontSize: 15,
    lineHeight: 19,
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
  chartInner: { marginTop: spacing.sm },
  barScrollContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  barColumn: {
    width: 44,
    alignItems: "center",
  },
  barTrack: {
    height: BAR_CHART_HEIGHT,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barFill: {
    width: 28,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barAxisLabel: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: fontFamily.body,
    maxWidth: 44,
    textAlign: "center",
  },
  barCount: {
    marginTop: 2,
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
});
