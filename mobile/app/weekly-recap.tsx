import { type Href, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";

import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { buildWrappedSlides } from "../features/weeklyRecap/wrappedSlides";
import {
  WeeklyWrappedShareCard,
  type WeeklyShareTemplateId,
} from "../features/weeklyRecap/WeeklyWrappedShareCard";
import { WeeklyWrappedViewer } from "../features/weeklyRecap/WeeklyWrappedViewer";
import { colors, spacing } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { apiJson } from "../lib/client";
import { sessionTypeLabel } from "../lib/sessionI18n";
import { tryParseWeeklyReviewDto } from "../lib/outcomesDto";
import { tryParseSessionStatsDto } from "../lib/statsDto";
import type { SessionStatsDto } from "../types/session";
import type { WeeklyReviewDto } from "../types/outcomes";

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

export default function WeeklyRecapScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [review, setReview] = useState<WeeklyReviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statsWarning, setStatsWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareTemplate, setShareTemplate] = useState<WeeklyShareTemplateId>("gradient");
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
        return;
      }
      if (!silent) setLoading(true);

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
    },
    [token, t],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
  }, [t, token]);

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

  const topBreakdown = useMemo(
    () => [...(stats?.breakdown ?? [])].sort((a, b) => b.sessions - a.sessions)[0] ?? null,
    [stats?.breakdown],
  );
  const topTypeLabel =
    topBreakdown && topBreakdown.sessions > 0
      ? sessionTypeLabel(String(topBreakdown.session_type), t)
      : null;

  const hasCardData = Boolean(s || review);
  const showFatalError = Boolean(token) && !loading && error && !hasCardData;
  const showSignIn = !token && !loading;

  const slides = useMemo(
    () =>
      buildWrappedSlides({
        t,
        review,
        stats,
        displaySessions,
        displayHours,
        weekRange,
      }),
    [displayHours, displaySessions, review, stats, t, weekRange],
  );

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
  }, [displayHours, displaySessions, hasCardData, review, shareBusy, stats, t]);

  const onShareText = useCallback(() => {
    const { message, url } = buildSharePayload(t, review, stats, displaySessions, displayHours);
    Share.share(url ? { message, url } : { message }).catch(() => undefined);
  }, [displayHours, displaySessions, review, stats, t]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (showSignIn) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.stateWrap}>
          <EmptyState
            title={t("weeklyRecap.needSignInTitle")}
            message={t("weeklyRecap.needSignInBody")}
            actionLabel={t("weeklyRecap.signInCta")}
            onAction={() => router.replace("/(auth)/login" as Href)}
          />
          <PrimaryButton label={t("weeklyRecap.close")} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (showFatalError) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.stateWrap}>
          <ErrorState
            title={t("common.oops")}
            message={error ?? ""}
            retryLabel={t("common.tryAgain")}
            onRetry={() => void load()}
          />
          <PrimaryButton label={t("weeklyRecap.close")} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.fullscreen}>
      <WeeklyWrappedViewer
        slides={slides}
        t={t}
        onClose={() => router.back()}
        showGenerate={Boolean(token && !review)}
        generateBusy={generateBusy}
        generateError={generateError}
        onGenerate={() => void onGenerateRecap()}
        showShare={Boolean(token && hasCardData)}
        shareBusy={shareBusy}
        shareTemplate={shareTemplate}
        onShareTemplateChange={setShareTemplate}
        onShareCard={() => void onShareWeekCard()}
        onShareText={onShareText}
        onSetGoals={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          router.push("/(tabs)/stats");
        }}
        onStartSession={() => router.push("/session/setup" as Href)}
        statsWarning={statsWarning}
      />

      <View style={styles.hiddenShot} pointerEvents="none">
        <ViewShot
          ref={(node) => {
            shotRef.current = node;
          }}
          options={{ format: "png", quality: 1 }}
          style={styles.shotInner}
        >
          <WeeklyWrappedShareCard
            t={t}
            template={shareTemplate}
            displaySessions={displaySessions}
            displayHours={displayHours}
            currentStreak={s?.current_streak_days ?? 0}
            bestStreak={s?.best_streak_days ?? 0}
            weekRange={weekRange}
            topTypeLabel={topTypeLabel}
          />
        </ViewShot>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fullscreen: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stateWrap: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: "center",
  },
  hiddenShot: {
    position: "absolute",
    left: -5000,
    top: 0,
    width: 360,
    height: 640,
  },
  shotInner: { width: 360, height: 640 },
});
