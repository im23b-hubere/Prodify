import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StatCard } from "../../components/ui/StatCard";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { debugLog } from "../../lib/debugLog";
import { formatSessionListDate, weekdayLetterFromIsoDay } from "../../lib/sessionTime";
import { tryParseHeatmapDays, tryParsePersonalRecords, tryParseSessionStatsDto } from "../../lib/statsDto";
import type { SessionDto, SessionStatsDto } from "../../types/session";

type HeatmapDay = { date: string; seconds: number; intensity: number };
type PersonalRecord = { key: string; label: string; value: string; context: string | null; occurred_at: string | null };

const FILTERS = [
  { key: "7d" as const, label: "7D", period: "week" as const },
  { key: "30d" as const, label: "30D", period: "month" as const },
  { key: "all" as const, label: "All", period: "all" as const },
];

const BREAKDOWN_COLORS = [colors.primary, colors.secondary, colors.success];

function formatDuration(seconds: number) {
  const s = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return `${hours}h ${rest}m`;
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
  const { token } = useAuth();
  const router = useRouter();
  const [filterIdx, setFilterIdx] = useState(0);
  const filter = FILTERS[filterIdx];
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loadSeq = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadSeq.current += 1;
    };
  }, []);

  const periodParam = filter.period === "week" ? "week" : filter.period === "month" ? "month" : "all";

  const loadStats = useCallback(async () => {
    if (!token) return;
    const seq = ++loadSeq.current;
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
          setError("Invalid stats response from server.");
        }
        return;
      }
      if (mounted.current) {
        setStats(parsed);
        setHeatmapDays(tryParseHeatmapDays(rawHm));
        setRecords(tryParsePersonalRecords(rawRec));
      }
    } catch (e) {
      if (!mounted.current || seq !== loadSeq.current) return;
      const msg = e instanceof Error ? e.message : "Failed to load stats";
      debugLog("stats", "stats_fetch_failed", { period: periodParam, message: msg });
      if (mounted.current) setError(msg);
    }
  }, [periodParam, token]);

  useEffect(() => {
    loadStats().catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"));
  }, [loadStats]);

  const onRefresh = useCallback(async () => {
    if (mounted.current) setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await loadStats().catch((e) => {
      if (mounted.current) setError(e instanceof Error ? e.message : "Failed to load stats");
    });
    if (mounted.current) setRefreshing(false);
  }, [loadStats]);

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
    if (points.length === 0) return [{ x: "—", y: 0, label: "-" }];
    return points.map((p) => ({
      x: weekdayLetterFromIsoDay(p.label),
      y: Number.isFinite(p.sessions) && p.sessions >= 0 ? p.sessions : 0,
      label: p.label,
    }));
  }, [stats]);

  const breakdownData = useMemo(
    () =>
      (stats?.breakdown ?? []).map((item, idx) => ({
        label: item.session_type,
        value: Math.max(0, Math.round(item.percent)),
        sessions: item.sessions,
        color: BREAKDOWN_COLORS[idx % BREAKDOWN_COLORS.length],
      })),
    [stats]
  );

  const recent = stats?.recent_sessions ?? [];

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
          style={styles.recentRow}
          onPress={() => {
            if (!canOpen) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            router.push(`/session/${sid}`);
          }}
          disabled={!canOpen}
        >
          <Text style={styles.recentType}>{item.session_type ?? "Session"}</Text>
          <View style={styles.recentMid}>
            <Text style={styles.recentDur}>{formatDuration(item.duration_seconds ?? 0)}</Text>
            <Text style={styles.recentDate}>{formatSessionListDate(item.started_at)}</Text>
          </View>
          <Text style={styles.recentChev}>›</Text>
        </Pressable>
      );
    },
    [router]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Your stats</Text>
          <View style={styles.filterRow}>
            {FILTERS.map((f, i) => (
              <Pressable
                key={f.key}
                style={[styles.filterChip, filterIdx === i && styles.filterChipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  setFilterIdx(i);
                }}
              >
                <Text style={[styles.filterLabel, filterIdx === i && styles.filterLabelActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={172}
          decelerationRate="fast"
          contentContainerStyle={styles.cardRow}
        >
          <StatCard
            label="Total hours"
            value={summary.hours}
            sublabel={
              summary.delta != null
                ? `${summary.delta >= 0 ? "+" : ""}${summary.delta}h vs prior period`
                : undefined
            }
            subPositive={summary.delta == null || summary.delta >= 0}
          />
          <StatCard label="Sessions" value={summary.sessions} />
          <StatCard
            label="Current streak"
            value={`🔥 ${summary.streak}`}
            sublabel={`Best: ${summary.bestStreak} days`}
          />
        </ScrollView>

        {weekGoal ? (
          <View style={styles.goalCard}>
            <Text style={styles.goalTitle}>
              Weekly presence {weekGoal.daysWith}/{weekGoal.goal} days
            </Text>
            <Text style={styles.goalSub}>
              {weekGoal.daysWith >= weekGoal.goal
                ? "Goal crushed — keep the momentum."
                : `${weekGoal.goal - weekGoal.daysWith} more day${weekGoal.goal - weekGoal.daysWith === 1 ? "" : "s"} to hit 7/7.`}
            </Text>
          </View>
        ) : null}

        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Activity heatmap (90 days)</Text>
          <View style={styles.heatmapGrid}>
            {heatmapDays.map((d) => (
              <View
                key={d.date}
                style={[
                  styles.heatCell,
                  {
                    opacity: 0.25 + d.intensity * 0.18,
                    backgroundColor:
                      d.intensity === 0 ? "#1e1e1e" : d.intensity < 3 ? colors.primary : colors.secondary,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Personal records</Text>
          {records.length === 0 ? (
            <Text style={styles.emptyText}>Complete sessions to unlock records.</Text>
          ) : (
            records.map((r) => (
              <View key={r.key + (r.occurred_at ?? "")} style={styles.recordRow}>
                <Text style={styles.recordLabel}>{r.label}</Text>
                <Text style={styles.recordVal}>{r.value}</Text>
                {r.context ? <Text style={styles.recordCtx}>{r.context}</Text> : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Sessions per day</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.chartInner}>
            <SessionsPerDayChart data={chartData} />
          </View>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Session type mix</Text>
          {breakdownData.length > 0 ? (
            <View style={styles.breakdownWrap}>
              {breakdownData.map((item) => (
                <View key={item.label} style={styles.breakdownRow}>
                  <View style={styles.breakdownLabelWrap}>
                    <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.breakdownTrack}>
                    <View style={[styles.breakdownFill, { width: `${item.value}%`, backgroundColor: item.color }]} />
                  </View>
                  <Text style={styles.breakdownValue}>
                    {item.sessions} · {item.value}%
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No stats yet. Complete a session to see your insights.</Text>
            </View>
          )}
        </View>

        {stats?.productivity_hint ? (
          <View style={styles.hintCard}>
            <Text style={styles.hintText}>{stats.productivity_hint}</Text>
          </View>
        ) : null}

        <Text style={styles.recentTitle}>Recent sessions</Text>
        {recent.length === 0 ? (
          <Text style={styles.emptyText}>No sessions in this range.</Text>
        ) : (
          recent.map((item) => (
            <View key={typeof item.id === "number" && item.id > 0 ? item.id : `r-${item.started_at}`}>
              {renderRecent({ item })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  headerRow: { marginBottom: spacing.md, gap: spacing.sm },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
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
  filterLabel: { color: colors.textSecondary, fontFamily: fontFamily.bodyMedium, ...typography.caption },
  filterLabelActive: { color: colors.textPrimary },
  cardRow: { gap: spacing.sm, paddingBottom: spacing.md },
  goalCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  goalTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  goalSub: { color: colors.textSecondary, marginTop: 4, ...typography.caption },
  chartCard: {
    marginBottom: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  cardTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
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
  recordRow: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recordLabel: { color: colors.textSecondary, ...typography.caption },
  recordVal: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.subheadline, marginTop: 4 },
  recordCtx: { color: colors.textSecondary, ...typography.caption, marginTop: 4 },
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
    width: 88,
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
    ...typography.caption,
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
    ...typography.caption,
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
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(162,89,255,0.12)",
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  hintText: { color: colors.textSecondary, ...typography.caption, lineHeight: 20 },
  recentTitle: {
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.subheadline,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  recentType: { flex: 1, color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  recentMid: { alignItems: "flex-end", marginRight: spacing.sm },
  recentDur: { color: colors.textPrimary, ...typography.caption },
  recentDate: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  recentChev: { color: colors.primary, fontSize: 22 },
});
