import { type Href, useRouter } from "expo-router";
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
import { useWeeklyRecapData } from "../features/weeklyRecap/useWeeklyRecapData";
import { colors, spacing } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { sessionTypeLabel } from "../lib/sessionI18n";
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
  const {
    stats,
    review,
    error,
    statsWarning,
    loading,
    generateBusy,
    generateError,
    load,
    generateRecap,
  } = useWeeklyRecapData(token, t);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareTemplate, setShareTemplate] = useState<WeeklyShareTemplateId>("gradient");
  const shotRef = useRef<ViewShot | null>(null);

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
        onGenerate={() => void generateRecap()}
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
