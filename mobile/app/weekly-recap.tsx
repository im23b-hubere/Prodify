import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { fontFamily } from "../constants/fonts";
import { colors, radii, spacing, typography } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { apiJson } from "../lib/client";
import { tryParseSessionStatsDto } from "../lib/statsDto";
import { tryParseWeeklyReviewDto } from "../lib/outcomesDto";
import type { SessionStatsDto } from "../types/session";
import type { WeeklyReviewDto } from "../types/outcomes";

export default function WeeklyRecapScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [review, setReview] = useState<WeeklyReviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [rawReview, rawStats] = await Promise.all([
        apiJson<unknown>("/outcomes/weekly-review/current", { token }).catch(() => null),
        apiJson<unknown>("/sessions/stats?period=week", { token }),
      ]);
      const parsedReview = rawReview ? tryParseWeeklyReviewDto(rawReview) : null;
      setReview(parsedReview);
      const parsedStats = tryParseSessionStatsDto(rawStats);
      setStats(parsedStats);
      if (!parsedStats) setError(t("weeklyRecap.invalidStats"));
    } catch (e) {
      setStats(null);
      setReview(null);
      setError(e instanceof Error ? e.message : t("weeklyRecap.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = stats?.summary;
  const displaySessions = review?.total_sessions ?? s?.total_sessions ?? 0;
  const displayHours =
    (Number.isFinite(review?.total_seconds)
      ? (review?.total_seconds ?? 0)
      : (s?.total_seconds ?? 0)) / 3600;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("weeklyRecap.title")}</Text>
        {loading ? <LoadingState message={t("weeklyRecap.loading")} /> : null}
        {!loading && error ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("common.tryAgain")}
            onRetry={() => void load()}
          />
        ) : null}
        {!loading && !error && s ? (
          <View style={styles.card}>
            <Text style={styles.line}>
              {t("weeklyRecap.sessionsHours", {
                sessions: displaySessions,
                hours: displayHours.toFixed(1),
              })}
            </Text>
            <Text style={styles.line}>
              {t("weeklyRecap.streakBest", {
                current: s.current_streak_days,
                best: s.best_streak_days,
              })}
            </Text>
            {s.hours_delta_vs_prior_period != null ? (
              <Text style={styles.line}>
                {t("weeklyRecap.vsPrior", {
                  sign: s.hours_delta_vs_prior_period >= 0 ? "+" : "",
                  hours: s.hours_delta_vs_prior_period,
                })}
              </Text>
            ) : null}
            {review?.insights?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("weeklyRecap.sections.insights")}</Text>
                {review.insights.slice(0, 3).map((item) => (
                  <Text key={item} style={styles.line}>
                    - {item}
                  </Text>
                ))}
              </View>
            ) : null}
            {review?.blockers?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("weeklyRecap.sections.blockers")}</Text>
                {review.blockers.slice(0, 2).map((item) => (
                  <Text key={item} style={styles.line}>
                    - {item}
                  </Text>
                ))}
              </View>
            ) : null}
            {review?.suggestions?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("weeklyRecap.sections.nextWeek")}</Text>
                {review.suggestions.slice(0, 3).map((item) => (
                  <Text key={item} style={styles.line}>
                    - {item}
                  </Text>
                ))}
              </View>
            ) : null}
            <Text style={styles.quote}>{review?.ai_feedback || t("weeklyRecap.quote")}</Text>
          </View>
        ) : null}
        {!loading && !error && !s ? (
          <EmptyState
            title={t("weeklyRecap.emptyTitle")}
            message={t("weeklyRecap.emptyBody")}
            actionLabel={t("common.tryAgain")}
            onAction={() => void load()}
          />
        ) : null}
        <PrimaryButton
          label={t("weeklyRecap.shareCta")}
          onPress={() => {
            const text =
              review?.ai_feedback ??
              t("weeklyRecap.shareFallback", {
                sessions: displaySessions,
                hours: displayHours.toFixed(1),
              });
            Share.share({ message: text }).catch(() => undefined);
          }}
        />
        <PrimaryButton
          label={t("weeklyRecap.setGoals")}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            router.push("/(tabs)/stats");
          }}
        />
        <Pressable
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t("weeklyRecap.close")}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            router.back();
          }}
        >
          <Text style={styles.backTxt}>{t("weeklyRecap.close")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  line: { color: colors.textPrimary, ...typography.body },
  quote: {
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.md,
    ...typography.caption,
  },
  section: { marginTop: spacing.sm, gap: spacing.xs },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  back: { alignItems: "center", padding: spacing.md },
  backTxt: { color: colors.primary, fontFamily: fontFamily.bodyBold },
});
