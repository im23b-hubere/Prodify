import { useFocusEffect } from "@react-navigation/native";
import { Href, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Calendar, ChevronLeft } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EmptyState } from "../../components/states/EmptyState";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { AppCard } from "../../components/ui/AppCard";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import type { StreakOverviewDto, StreakRunDto } from "../../types/streak";

const HISTORY_FETCH_LIMIT = 120;

/** Calendar YYYY-MM-DD in UTC (matches server `utcnow().date().isoformat()`). */
function utcCalendarDateIso(dayOffset = 0): string {
  const d = new Date();
  const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + dayOffset);
  return new Date(ms).toISOString().slice(0, 10);
}

function isActiveStreakRun(
  run: StreakRunDto,
  index: number,
  currentStreak: number | null,
): boolean {
  if (currentStreak == null || currentStreak < 1 || index !== 0) return false;
  if (run.length_days !== currentStreak) return false;
  const today = utcCalendarDateIso(0);
  const yesterday = utcCalendarDateIso(-1);
  return run.end_date === today || run.end_date === yesterday;
}

function formatRange(startIso: string, endIso: string): string {
  try {
    const s = new Date(`${startIso}T12:00:00Z`);
    const e = new Date(`${endIso}T12:00:00Z`);
    const same = startIso === endIso;
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    if (same) return s.toLocaleDateString(undefined, opts);
    return `${s.toLocaleDateString(undefined, opts)} → ${e.toLocaleDateString(undefined, opts)}`;
  } catch {
    return `${startIso} → ${endIso}`;
  }
}

export default function StreakHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const [runs, setRuns] = useState<StreakRunDto[]>([]);
  const [currentStreakSnapshot, setCurrentStreakSnapshot] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setRuns([]);
      setCurrentStreakSnapshot(null);
      setError(null);
      setRefreshing(false);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [histRes, ovRes] = await Promise.allSettled([
        apiJson<StreakRunDto[]>(`/streak/history?limit=${HISTORY_FETCH_LIMIT}`, { token }),
        apiJson<StreakOverviewDto>("/streak/overview", { token }),
      ]);

      if (ovRes.status === "fulfilled" && typeof ovRes.value.current_streak === "number") {
        setCurrentStreakSnapshot(ovRes.value.current_streak);
      } else {
        setCurrentStreakSnapshot(null);
      }

      if (histRes.status === "fulfilled") {
        const data = histRes.value;
        setRuns(Array.isArray(data) ? data : []);
      } else {
        const e = histRes.reason;
        setRuns([]);
        setCurrentStreakSnapshot(null);
        throw e instanceof Error ? e : new Error(t("streakHistory.loadError"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("streakHistory.loadError"));
      setRuns([]);
      setCurrentStreakSnapshot(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    if (!token) return;
    setRefreshing(true);
    load().catch(() => undefined);
  }, [load, token]);

  const showSignIn = !token && !loading;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("streakHistory.backA11y")}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            router.back();
          }}
        >
          <ChevronLeft color={colors.textPrimary} size={26} />
        </Pressable>
        <Text style={styles.title}>{t("streakHistory.title")}</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          token ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {loading && !refreshing ? <LoadingState message={t("streakHistory.loading")} /> : null}

        {showSignIn ? (
          <AppCard>
            <Text style={styles.cardTitle}>{t("streakHistory.needSignInTitle")}</Text>
            <Text style={styles.cardBody}>{t("streakHistory.needSignInBody")}</Text>
            <PrimaryButton
              label={t("streakHistory.signInCta")}
              onPress={() => router.replace("/(auth)/login" as Href)}
            />
          </AppCard>
        ) : null}

        {token && error ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("common.tryAgain")}
            onRetry={() => {
              setLoading(true);
              load().catch(() => undefined);
            }}
          />
        ) : null}

        {token && !loading && !error && runs.length === 0 ? (
          <EmptyState
            iconNode={<Calendar color={colors.primary} size={40} />}
            title={t("streakHistory.emptyTitle")}
            message={t("streakHistory.emptySub")}
            actionLabel={t("streakHistory.emptyCta")}
            onAction={() => router.push("/session/setup" as Href)}
          />
        ) : null}

        {runs.map((run, i) => {
          const isCurrent = isActiveStreakRun(run, i, currentStreakSnapshot);
          return (
            <Animated.View
              key={`${run.start_date}-${run.end_date}-${i}`}
              entering={FadeInDown.delay(i * 40).duration(360)}
            >
              <View
                style={[styles.card, isCurrent && styles.cardCurrent]}
                accessibilityRole="text"
                accessibilityLabel={
                  isCurrent
                    ? t("streakHistory.runA11yCurrent", {
                        count: run.length_days,
                        start: run.start_date,
                        end: run.end_date,
                      })
                    : t("streakHistory.runA11y", {
                        count: run.length_days,
                        start: run.start_date,
                        end: run.end_date,
                      })
                }
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.days}>
                    {run.length_days} {t("streakHistory.dayUnit", { count: run.length_days })}
                  </Text>
                  {isCurrent ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>{t("streakHistory.currentBadge")}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.range}>{formatRange(run.start_date, run.end_date)}</Text>
              </View>
            </Animated.View>
          );
        })}

        {token && !loading && !error && runs.length > 0 ? (
          <Text style={styles.footnote}>
            {t("streakHistory.footnote", { limit: HISTORY_FETCH_LIMIT })}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
  pressed: { opacity: 0.85 },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
  },
  backSpacer: { width: 40 },
  scroll: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.cardTitle,
  },
  cardBody: {
    color: colors.textSecondary,
    ...typography.body,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardCurrent: {
    borderColor: "rgba(255,106,61,0.45)",
    backgroundColor: "rgba(255,106,61,0.06)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  days: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
  },
  currentBadge: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(255,106,61,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,106,61,0.35)",
  },
  currentBadgeText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  range: {
    color: colors.textSecondary,
    ...typography.body,
    marginTop: spacing.xs,
  },
  footnote: {
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
