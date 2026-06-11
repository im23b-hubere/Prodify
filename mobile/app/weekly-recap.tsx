import { type Href, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Lightbulb, Sparkles, TriangleAlert } from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";

import { AppCard } from "../components/ui/AppCard";
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

type WeeklyShareTemplateId = "minimal" | "gradient";

type WeeklyShareCardProps = {
  t: (key: string, opts?: Record<string, unknown>) => string;
  template: WeeklyShareTemplateId;
  displaySessions: number;
  displayHours: string;
  currentStreak: number;
  bestStreak: number;
  weekRange?: string;
};

function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  try {
    const a = new Date(weekStart);
    const b = new Date(weekEnd);
    if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return "";
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, opts)}`;
  } catch {
    return "";
  }
}

function buildSharePayload(
  t: (key: string, opts?: Record<string, unknown>) => string,
  review: WeeklyReviewDto | null,
  stats: SessionStatsDto | null,
  displaySessions: number,
  displayHours: string,
): { message: string; url?: string } {
  const lines: string[] = [];
  lines.push(t("weeklyRecap.shareHeadline"));
  lines.push(
    t("weeklyRecap.sessionsHours", {
      sessions: displaySessions,
      hours: displayHours,
    }),
  );
  const s = stats?.summary;
  if (s) {
    lines.push(
      t("weeklyRecap.streakBest", {
        current: s.current_streak_days,
        best: s.best_streak_days,
      }),
    );
  }
  if (review?.insights?.length) {
    lines.push("", t("weeklyRecap.shareInsightsIntro"));
    for (const item of review.insights.slice(0, 3)) {
      lines.push(`• ${item}`);
    }
  }
  const feedback = review?.ai_feedback?.trim();
  if (feedback) {
    lines.push("", feedback);
  }
  const message = lines.join("\n").trim();
  const url =
    review?.share_image_url && /^https?:\/\//i.test(review.share_image_url)
      ? review.share_image_url
      : undefined;
  return {
    message:
      message || t("weeklyRecap.shareFallback", { sessions: displaySessions, hours: displayHours }),
    url,
  };
}

function WeeklyShareCard({
  t,
  template,
  displaySessions,
  displayHours,
  currentStreak,
  bestStreak,
  weekRange,
}: WeeklyShareCardProps) {
  const isGradient = template === "gradient";
  const cardTitle = isGradient ? "Prodify" : t("weeklyRecap.title");
  const cardSubtitle =
    currentStreak >= 7
      ? "Momentum is compounding."
      : currentStreak >= 3
        ? "Keep the streak alive."
        : "Show up and build momentum.";
  return (
    <View
      style={[
        styles.shareCard,
        template === "minimal" && styles.shareCardMinimal,
        template === "gradient" && styles.shareCardGradient,
      ]}
    >
      <View style={styles.shareTopRow}>
        <View style={styles.shareTitleBlock}>
          <Text style={styles.shareCardKicker}>{cardTitle}</Text>
          <Text style={styles.shareCardSubtitle}>{cardSubtitle}</Text>
        </View>
        {weekRange ? <Text style={styles.shareCardRange}>{weekRange}</Text> : null}
      </View>

      <View style={[styles.shareHero, isGradient && styles.shareHeroGradient]}>
        <View style={styles.shareHeroMetric}>
          <Text style={styles.shareHeroValue}>{displaySessions}</Text>
          <Text style={styles.shareHeroLabel}>{t("weeklyRecap.kpiSessions")}</Text>
        </View>
        <View style={styles.shareHeroDivider} />
        <View style={styles.shareHeroMetric}>
          <Text style={styles.shareHeroValue}>{displayHours}h</Text>
          <Text style={styles.shareHeroLabel}>{t("weeklyRecap.kpiHours")}</Text>
        </View>
      </View>

      <View style={styles.sharePillsRow}>
        <View style={styles.sharePill}>
          <Text style={styles.sharePillLabel}>{t("weeklyRecap.kpiCurrentStreak")}</Text>
          <Text style={styles.sharePillValue}>{currentStreak}</Text>
        </View>
        <View style={styles.sharePill}>
          <Text style={styles.sharePillLabel}>{t("weeklyRecap.kpiBestStreak")}</Text>
          <Text style={styles.sharePillValue}>{bestStreak}</Text>
        </View>
      </View>

      <Text style={styles.shareSummaryText}>
        {t("weeklyRecap.sessionsHours", {
          sessions: displaySessions,
          hours: displayHours,
        })}
      </Text>

      <Text style={styles.shareCardFooter}>Prodify</Text>
    </View>
  );
}

export default function WeeklyRecapScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [review, setReview] = useState<WeeklyReviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statsWarning, setStatsWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareTemplate, setShareTemplate] = useState<WeeklyShareTemplateId>("minimal");
  const shotRef = useRef<ViewShot | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      setError(null);
      setStatsWarning(null);
      setGenerateError(null);
      if (!token) {
        setStats(null);
        setReview(null);
        if (!silent) setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!silent) setLoading(true);
      else setRefreshing(true);

      let parsedReview: WeeklyReviewDto | null = null;
      try {
        const rawReview = await apiJson<unknown>("/outcomes/weekly-review/current", { token });
        parsedReview = tryParseWeeklyReviewDto(rawReview);
      } catch {
        parsedReview = null;
      }
      setReview(parsedReview);

      let parsedStats: SessionStatsDto | null = null;
      let statsErr: string | null = null;
      try {
        const rawStats = await apiJson<unknown>("/sessions/stats?period=week", { token });
        parsedStats = tryParseSessionStatsDto(rawStats);
        if (!parsedStats) {
          statsErr = t("weeklyRecap.invalidStats");
        }
      } catch (e) {
        statsErr = e instanceof Error ? e.message : t("weeklyRecap.loadFailed");
      }
      setStats(parsedStats);

      if (statsErr) {
        if (parsedReview) {
          setStatsWarning(statsErr);
          setError(null);
        } else {
          setError(statsErr);
        }
      } else {
        setError(null);
      }

      if (!silent) setLoading(false);
      setRefreshing(false);
    },
    [token, t],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    void load({ silent: true });
  }, [load]);

  const onGenerateRecap = useCallback(async () => {
    if (!token) return;
    setGenerateBusy(true);
    setGenerateError(null);
    try {
      const raw = await apiJson<unknown>("/outcomes/weekly-review/generate", {
        token,
        method: "POST",
        body: {},
      });
      const parsed = tryParseWeeklyReviewDto(raw);
      if (parsed) {
        setReview(parsed);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      } else {
        setGenerateError(t("weeklyRecap.generateInvalid"));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("weeklyRecap.generateFailed");
      setGenerateError(msg);
    } finally {
      setGenerateBusy(false);
    }
  }, [token, t]);

  const s = stats?.summary;
  const displaySessions = review?.total_sessions ?? s?.total_sessions ?? 0;
  const displayHoursRaw =
    (Number.isFinite(review?.total_seconds)
      ? (review?.total_seconds ?? 0)
      : (s?.total_seconds ?? 0)) / 3600;
  const displayHours = Number.isFinite(displayHoursRaw) ? displayHoursRaw.toFixed(1) : "0.0";

  const weekRange =
    review?.week_start && review?.week_end
      ? formatWeekRangeLabel(review.week_start, review.week_end)
      : "";

  const hasCardData = Boolean(s || review);
  const showEmpty = Boolean(token) && !loading && !error && !hasCardData;
  const showFatalError = Boolean(token) && !loading && error && !hasCardData;
  const showSignIn = !token && !loading;

  const onShareWeekCard = useCallback(async () => {
    if (!hasCardData || shareBusy) return;
    setShareBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 120));
      const uri = await shotRef.current?.capture?.();
      if (!uri) {
        Share.share({
          message: buildSharePayload(t, review, stats, displaySessions, displayHours).message,
        }).catch(() => undefined);
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          UTI: "public.png",
          dialogTitle: t("weeklyRecap.shareDialogTitle"),
        });
      } else {
        Share.share({
          message: buildSharePayload(t, review, stats, displaySessions, displayHours).message,
        }).catch(() => undefined);
      }
    } finally {
      setShareBusy(false);
    }
  }, [displayHours, displaySessions, hasCardData, review, shareBusy, shotRef, stats, t]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
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
        <Text style={styles.title}>{t("weeklyRecap.title")}</Text>
        {weekRange ? <Text style={styles.weekRange}>{weekRange}</Text> : null}

        {loading && !refreshing ? <LoadingState message={t("weeklyRecap.loading")} /> : null}

        {showSignIn ? (
          <AppCard>
            <Text style={styles.cardTitle}>{t("weeklyRecap.needSignInTitle")}</Text>
            <Text style={styles.lineMuted}>{t("weeklyRecap.needSignInBody")}</Text>
            <PrimaryButton
              label={t("weeklyRecap.signInCta")}
              onPress={() => router.replace("/(auth)/login" as Href)}
            />
          </AppCard>
        ) : null}

        {showFatalError ? (
          <ErrorState
            title={t("common.oops")}
            message={error ?? ""}
            retryLabel={t("common.tryAgain")}
            onRetry={() => void load()}
          />
        ) : null}

        {!loading && !showFatalError && !showSignIn && hasCardData ? (
          <View style={styles.recapStack}>
            <View style={styles.recapHero}>
              {statsWarning ? <Text style={styles.statsWarning}>{statsWarning}</Text> : null}
              <Text style={styles.recapHeroTitle}>{t("weeklyRecap.title")}</Text>
              <Text style={styles.recapHeroSubtitle}>
                {t("weeklyRecap.sessionsHours", {
                  sessions: displaySessions,
                  hours: displayHours,
                })}
              </Text>
              {s ? (
                <Text style={styles.recapHeroMeta}>
                  {t("weeklyRecap.streakBest", {
                    current: s.current_streak_days,
                    best: s.best_streak_days,
                  })}
                </Text>
              ) : null}
              {s?.hours_delta_vs_prior_period != null ? (
                <Text style={styles.recapHeroMeta}>
                  {t("weeklyRecap.vsPrior", {
                    sign: s.hours_delta_vs_prior_period >= 0 ? "+" : "",
                    hours: s.hours_delta_vs_prior_period,
                  })}
                </Text>
              ) : null}
            </View>

            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{t("weeklyRecap.kpiSessions")}</Text>
                <Text style={styles.kpiValue}>{displaySessions}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{t("weeklyRecap.kpiHours")}</Text>
                <Text style={styles.kpiValue}>{displayHours}h</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{t("weeklyRecap.kpiCurrentStreak")}</Text>
                <Text style={styles.kpiValue}>{s?.current_streak_days ?? 0}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{t("weeklyRecap.kpiBestStreak")}</Text>
                <Text style={styles.kpiValue}>{s?.best_streak_days ?? 0}</Text>
              </View>
            </View>

            {review?.insights?.length ? (
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View style={styles.insightIconWrap}>
                    <Lightbulb size={14} color="#ffb07a" />
                  </View>
                  <Text style={styles.insightTitle}>{t("weeklyRecap.sections.insights")}</Text>
                </View>
                {review.insights.slice(0, 2).map((item) => (
                  <Text key={`insight-${item}`} style={styles.insightItem} numberOfLines={3}>
                    {"\u2022"} {item}
                  </Text>
                ))}
              </View>
            ) : null}
            {review?.blockers?.length ? (
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View style={styles.insightIconWrap}>
                    <TriangleAlert size={14} color="#ff9e9e" />
                  </View>
                  <Text style={styles.insightTitle}>{t("weeklyRecap.sections.blockers")}</Text>
                </View>
                {review.blockers.slice(0, 2).map((item) => (
                  <Text key={`blocker-${item}`} style={styles.insightItem} numberOfLines={3}>
                    {"\u2022"} {item}
                  </Text>
                ))}
              </View>
            ) : null}
            {review?.suggestions?.length ? (
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View style={styles.insightIconWrap}>
                    <ArrowRight size={14} color="#ffb07a" />
                  </View>
                  <Text style={styles.insightTitle}>{t("weeklyRecap.sections.nextWeek")}</Text>
                </View>
                {review.suggestions.slice(0, 2).map((item) => (
                  <Text key={`suggestion-${item}`} style={styles.insightItem} numberOfLines={3}>
                    {"\u2022"} {item}
                  </Text>
                ))}
              </View>
            ) : null}

            {(review?.ai_feedback || "").trim() ? (
              <View style={styles.feedbackCard}>
                <View style={styles.insightHeader}>
                  <View style={styles.insightIconWrap}>
                    <Sparkles size={14} color="#cfb8ff" />
                  </View>
                  <Text style={styles.feedbackLabel}>{t("weeklyRecap.weeklyInsightLabel")}</Text>
                </View>
                <Text style={styles.feedbackText}>{review?.ai_feedback}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {showEmpty ? (
          <EmptyState
            title={t("weeklyRecap.emptyTitle")}
            message={t("weeklyRecap.emptyBody")}
            actionLabel={t("common.tryAgain")}
            onAction={() => void load()}
          />
        ) : null}

        {token && !review && !loading && !showFatalError && !showSignIn ? (
          <View style={styles.generateBlock}>
            <PrimaryButton
              label={t("weeklyRecap.generateCta")}
              loading={generateBusy}
              onPress={() => void onGenerateRecap()}
            />
            {generateError ? <Text style={styles.generateErr}>{generateError}</Text> : null}
          </View>
        ) : null}

        {token && !loading && !showSignIn ? (
          <View style={styles.shareActions}>
            <View style={styles.templateChips}>
              {(
                [
                  ["minimal", t("weeklyRecap.templateMinimal")],
                  ["gradient", t("weeklyRecap.templateGradient")],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  style={[styles.templateChip, shareTemplate === id && styles.templateChipActive]}
                  onPress={() => setShareTemplate(id)}
                >
                  <Text
                    style={[
                      styles.templateChipText,
                      shareTemplate === id && styles.templateChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.previewWrap}>
              <View style={styles.previewScale}>
                <WeeklyShareCard
                  t={t}
                  template={shareTemplate}
                  displaySessions={displaySessions}
                  displayHours={displayHours}
                  currentStreak={s?.current_streak_days ?? 0}
                  bestStreak={s?.best_streak_days ?? 0}
                  weekRange={weekRange}
                />
              </View>
            </View>
            <PrimaryButton
              label={shareBusy ? t("weeklyRecap.shareBusy") : t("weeklyRecap.shareWeekCardCta")}
              disabled={!hasCardData}
              onPress={() => {
                void onShareWeekCard();
              }}
            />
            <PrimaryButton
              label={t("weeklyRecap.shareCta")}
              disabled={!hasCardData}
              onPress={() => {
                const { message, url } = buildSharePayload(
                  t,
                  review,
                  stats,
                  displaySessions,
                  displayHours,
                );
                Share.share(url ? { message, url } : { message }).catch(() => undefined);
              }}
            />
          </View>
        ) : null}

        {token && !showSignIn ? (
          <PrimaryButton
            label={t("weeklyRecap.setGoals")}
            disabled={loading}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
              router.push("/(tabs)/stats");
            }}
          />
        ) : null}

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

        <View style={styles.hiddenShot} pointerEvents="none">
          <ViewShot
            ref={(node) => {
              shotRef.current = node;
            }}
            options={{ format: "png", quality: 1 }}
            style={styles.shotInner}
          >
            <WeeklyShareCard
              t={t}
              template={shareTemplate}
              displaySessions={displaySessions}
              displayHours={displayHours}
              currentStreak={s?.current_streak_days ?? 0}
              bestStreak={s?.best_streak_days ?? 0}
              weekRange={weekRange}
            />
          </ViewShot>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  weekRange: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
    marginTop: -spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
    marginBottom: spacing.xs,
  },
  lineMuted: { color: colors.textSecondary, ...typography.body, marginBottom: spacing.sm },
  recapStack: { gap: spacing.sm },
  recapHero: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,106,26,0.28)",
    backgroundColor: "rgba(255,106,26,0.1)",
    padding: spacing.lg,
    gap: spacing.xs,
  },
  recapHeroTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  recapHeroSubtitle: {
    color: "#ffcfad",
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  recapHeroMeta: {
    color: "rgba(255,255,255,0.86)",
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  kpiCard: {
    width: "48%",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: spacing.sm,
    gap: 4,
  },
  kpiLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  kpiValue: {
    color: colors.textPrimary,
    ...typography.subheadline,
    fontFamily: fontFamily.heading,
  },
  statsWarning: {
    color: "#fcd34d",
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  insightCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  insightIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  insightTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  insightItem: {
    color: colors.textPrimary,
    ...typography.body,
    lineHeight: 20,
  },
  feedbackCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.24)",
    backgroundColor: "rgba(162,89,255,0.08)",
    padding: spacing.md,
    gap: spacing.xs,
  },
  feedbackLabel: {
    color: "#cfb8ff",
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  feedbackText: {
    color: colors.textPrimary,
    ...typography.body,
    fontFamily: fontFamily.bodyMedium,
  },
  generateBlock: { gap: spacing.xs },
  generateErr: { color: colors.danger, ...typography.caption },
  shareActions: { gap: spacing.sm },
  templateChips: { flexDirection: "row", gap: spacing.xs },
  templateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  templateChipActive: {
    borderColor: "#ff6a1a",
    backgroundColor: "rgba(255,106,26,0.18)",
  },
  templateChipText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  templateChipTextActive: { color: colors.textPrimary },
  previewWrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#050505",
    overflow: "hidden",
    height: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  previewScale: {
    width: 360,
    height: 640,
    transform: [{ scale: 0.3 }],
  },
  back: { alignItems: "center", padding: spacing.md },
  backTxt: { color: colors.primary, fontFamily: fontFamily.bodyBold },
  hiddenShot: {
    position: "absolute",
    left: -5000,
    top: 0,
    width: 360,
    height: 640,
  },
  shotInner: { width: 360, height: 640 },
  shareCard: {
    width: 360,
    height: 640,
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  shareCardMinimal: {
    backgroundColor: "#0a0a0a",
    borderColor: "rgba(255,106,26,0.35)",
  },
  shareCardGradient: {
    backgroundColor: "#120d08",
    borderColor: "rgba(255,106,26,0.55)",
  },
  shareTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  shareTitleBlock: {
    flex: 1,
    gap: 2,
  },
  shareCardKicker: {
    color: "#ffb07a",
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  shareCardSubtitle: {
    color: "rgba(255,255,255,0.78)",
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  shareCardRange: {
    color: "rgba(255,255,255,0.72)",
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  shareHero: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,106,26,0.42)",
    backgroundColor: "rgba(255,106,26,0.12)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  shareHeroGradient: {
    borderColor: "rgba(255,106,26,0.62)",
    backgroundColor: "rgba(255,106,26,0.16)",
  },
  shareHeroMetric: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  shareHeroDivider: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(255,106,26,0.55)",
  },
  shareHeroValue: {
    color: "#fff4eb",
    fontFamily: fontFamily.heading,
    ...typography.headline,
  },
  shareHeroLabel: {
    color: "rgba(255,255,255,0.8)",
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  sharePillsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  sharePill: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,106,26,0.38)",
    backgroundColor: "rgba(255,106,26,0.08)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  sharePillLabel: {
    color: "rgba(255,255,255,0.78)",
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  sharePillValue: {
    color: "#fff4eb",
    ...typography.body,
    fontFamily: fontFamily.bodyBold,
  },
  shareSummaryText: {
    marginTop: spacing.sm,
    color: "rgba(255,255,255,0.82)",
    ...typography.body,
    fontFamily: fontFamily.bodyMedium,
  },
  shareCardFooter: {
    marginTop: "auto",
    color: "#ffb07a",
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
});
