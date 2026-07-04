import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionCompleteWeekCard } from "../../components/session/SessionCompleteWeekCard";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { StatTile } from "../../components/ui/StatTile";
import { TextButton } from "../../components/ui/TextButton";
import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography, ui } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { buildWeeklyForecast } from "../../lib/forecastEngine";
import { adjustedWeeklyTargetForSignupWeek } from "../../lib/goalPace";
import { progressionLevelName } from "../../lib/progressionLevels";
import { syncProgression } from "../../lib/progressionSync";
import {
  buildSessionFeedback,
  type SessionFeedbackComputed,
} from "../../lib/sessionFeedbackEngine";
import { sessionMoodLabel, sessionTypeLabel } from "../../lib/sessionI18n";
import { tryParseSessionDto } from "../../lib/sessionDto";
import { tryParseSessionStatsDto } from "../../lib/statsDto";
import { formatDurationWords } from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";
import type { ProgressionDto } from "../../types/outcomes";

const SESSION_XP_MINUTES_FLOOR = 5;
const BASE_SESSION_XP = 5;
const SESSION_XP_PER_MINUTE_AFTER_FLOOR = 0.5;
const SESSION_XP_MAX = 85;

function shortenLabel(value: string, max = 14): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}

function pickSessionHighlightKey(feedback: SessionFeedbackComputed): string {
  if (feedback.remainingSessionsToGoal === 0) {
    return feedback.statusMessageKey;
  }
  if (feedback.previousStatus != null && feedback.previousStatus !== feedback.newStatus) {
    return feedback.statusMessageKey;
  }
  if (feedback.newStatus === "off_track") {
    return feedback.statusMessageKey;
  }
  return feedback.emotionalMessageKey;
}

function estimateSessionXpGain(durationSeconds: number): number {
  const minutes = Math.max(0, Math.floor(durationSeconds / 60));
  if (minutes < SESSION_XP_MINUTES_FLOOR) return 0;
  const scaledMinutes = minutes - SESSION_XP_MINUTES_FLOOR;
  let raw = BASE_SESSION_XP + Math.floor(scaledMinutes * SESSION_XP_PER_MINUTE_AFTER_FLOOR);
  if (minutes >= 25) raw += 3;
  if (minutes >= 45) raw += 5;
  if (minutes >= 75) raw += 7;
  return Math.max(0, Math.min(SESSION_XP_MAX, raw));
}

export default function SessionCompleteScreen() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const [session, setSession] = useState<SessionDto | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [progression, setProgression] = useState<ProgressionDto | null>(null);
  const [weeklyGoalTarget, setWeeklyGoalTarget] = useState<number | null>(null);
  const [weekSessionsCount, setWeekSessionsCount] = useState<number>(0);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    if (!token || !id) {
      setLoadState("error");
      setLoadError(!token ? t("sessionComplete.notSignedIn") : t("sessionComplete.missingSession"));
      return;
    }
    if (!Number.isFinite(Number(id))) {
      setLoadState("error");
      setLoadError(t("sessionComplete.invalidSession"));
      return;
    }
    setLoadState("loading");
    setLoadError(null);
    try {
      const rawSession = await apiJson<unknown>(`/sessions/item/${id}`, { token });
      if (cancelled.current) return;
      const s = tryParseSessionDto(rawSession);
      if (!s) {
        setLoadState("error");
        setLoadError(t("sessionComplete.invalidData"));
        setSession(null);
        return;
      }
      if (s.stopped_at == null) {
        setLoadState("error");
        setLoadError(t("sessionComplete.stillInProgress"));
        setSession(null);
        return;
      }
      setSession(s);
      const [statsRaw, progressionRaw, goalRaw] = await Promise.all([
        apiJson<unknown>("/sessions/stats?period=all", { token }).catch(() => null),
        syncProgression(token, { force: true }).catch(() => null),
        apiJson<unknown>("/goals/current", { token }).catch(() => null),
      ]);
      if (cancelled.current) return;
      const stats = statsRaw ? tryParseSessionStatsDto(statsRaw) : null;
      setStreak(stats?.summary.current_streak_days ?? null);
      setProgression(progressionRaw);
      if (goalRaw && typeof goalRaw === "object") {
        const g = goalRaw as { target_value?: unknown; current_sessions?: unknown };
        setWeeklyGoalTarget(typeof g.target_value === "number" ? g.target_value : null);
        let counted = typeof g.current_sessions === "number" ? g.current_sessions : 0;
        if ((s.duration_seconds ?? 0) < SESSION_XP_MINUTES_FLOOR * 60 && counted > 0) {
          counted -= 1;
        }
        setWeekSessionsCount(Math.max(0, counted));
      } else {
        setWeeklyGoalTarget(null);
        setWeekSessionsCount(0);
      }
      setLoadState("ready");
    } catch (e) {
      if (cancelled.current) return;
      setLoadState("error");
      setLoadError(e instanceof Error ? e.message : t("sessionComplete.loadError"));
      setSession(null);
    }
  }, [id, token, t]);

  useEffect(() => {
    cancelled.current = false;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void load();
    return () => {
      cancelled.current = true;
    };
  }, [load]);

  const dur = session?.duration_seconds ?? 0;
  const effectiveWeeklyGoalTarget = useMemo(
    () =>
      adjustedWeeklyTargetForSignupWeek({
        weeklyGoalTarget,
        accountCreatedAtIso: user?.created_at ?? null,
      }),
    [weeklyGoalTarget, user?.created_at],
  );
  const xpGainEstimate = estimateSessionXpGain(dur);

  const feedback = useMemo(
    () =>
      buildSessionFeedback({
        weeklyGoalTarget: effectiveWeeklyGoalTarget,
        weekSessionsCount,
        currentStreak: streak ?? 0,
        sessionDurationSeconds: dur,
      }),
    [effectiveWeeklyGoalTarget, weekSessionsCount, streak, dur],
  );
  const paceForecast = useMemo(
    () =>
      effectiveWeeklyGoalTarget != null && effectiveWeeklyGoalTarget > 0
        ? buildWeeklyForecast({
            weeklyGoalTarget: effectiveWeeklyGoalTarget,
            completedThisWeek: weekSessionsCount,
          })
        : null,
    [effectiveWeeklyGoalTarget, weekSessionsCount],
  );

  if (loadState === "loading") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingTitle}>{t("sessionComplete.title")}</Text>
          <Text style={styles.muted}>{t("sessionComplete.loadingSession")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === "error") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Text style={styles.loadingTitle}>{t("sessionComplete.errorTitle")}</Text>
          <Text style={styles.muted}>{loadError ?? t("sessionComplete.unknownError")}</Text>
          <View style={styles.actions}>
            <PrimaryButton label={t("sessionComplete.tryAgain")} onPress={() => void load()} />
            <TextButton
              label={t("sessionComplete.backToDashboard")}
              onPress={() => router.replace("/(tabs)/dashboard")}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const sessionType = session?.session_type ?? "beat_making";
  const moodLabel =
    session?.mood_level != null ? sessionMoodLabel(session.mood_level, t) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="session-complete-screen">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={["#3d1510", "#1a1010", "#0a0a0a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroEyebrow}>{t("sessionComplete.heroEyebrow")}</Text>
          <Text style={styles.bigDur}>{formatDurationWords(dur)}</Text>
          <View style={styles.metaRow}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{sessionTypeLabel(sessionType, t)}</Text>
            </View>
            {moodLabel ? (
              <View style={styles.moodPill}>
                <Text style={styles.moodPillText}>{moodLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statGrid}>
            <StatTile
              label={t("sessionComplete.statXpLabel")}
              value={`+${xpGainEstimate}`}
              accent={xpGainEstimate > 0}
            />
            {streak !== null && streak > 0 ? (
              <StatTile
                label={t("sessionComplete.statStreakLabel")}
                value={`${streak}d`}
                icon="flame"
              />
            ) : null}
            {progression ? (
              <StatTile
                label={t("sessionComplete.statLevelLabel")}
                value={`${progression.current_level}`}
              />
            ) : null}
          </View>

          {xpGainEstimate === 0 ? (
            <Text style={styles.xpHintInline}>
              {t("sessionComplete.xpMinDurationHint", { min: SESSION_XP_MINUTES_FLOOR })}
            </Text>
          ) : progression ? (
            <Text style={styles.levelLine}>
              {t("sessionComplete.levelProgress", {
                name: shortenLabel(progressionLevelName(t, progression.current_level)),
                toNext: progression.xp_to_next_level,
                nextName: shortenLabel(progressionLevelName(t, progression.current_level + 1)),
              })}
            </Text>
          ) : null}

          <Text style={styles.punchline}>{t(pickSessionHighlightKey(feedback))}</Text>
        </LinearGradient>

        <SessionCompleteWeekCard
          t={t}
          feedback={feedback}
          weekSessionsCount={weekSessionsCount}
          weeklyGoalTarget={effectiveWeeklyGoalTarget}
          paceForecast={paceForecast}
        />

        <View style={styles.actions}>
          <PrimaryButton
            label={t("sessionComplete.viewDetails")}
            onPress={() => router.replace(`/session/${id}` as never)}
          />
          <SecondaryButton
            label={t("sessionComplete.backToDashboard")}
            onPress={() => router.replace("/(tabs)/dashboard")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: ui.screenPadding },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  scrollContent: { paddingBottom: spacing.xl },
  heroCard: {
    borderRadius: 24,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.22)",
    overflow: "hidden",
  },
  heroEyebrow: {
    color: colors.success,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  bigDur: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  typePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.45)",
    backgroundColor: "rgba(255,61,0,0.12)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  typePillText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  moodPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.4)",
    backgroundColor: "rgba(162,89,255,0.12)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  moodPillText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    marginTop: spacing.sm,
  },
  xpHintInline: {
    color: "#f59e0b",
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  levelLine: {
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  punchline: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
    textAlign: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    lineHeight: 22,
  },
  loadingTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.screenTitle,
    textAlign: "center",
  },
  muted: { color: colors.textSecondary, ...typography.meta, textAlign: "center" },
  actions: { marginTop: spacing.xl, gap: spacing.md },
});
