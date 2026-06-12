import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppFlame, glyphRowStyle } from "../../components/icons/ProdifyGlyphs";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { TextButton } from "../../components/ui/TextButton";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { AppCard } from "../../components/ui/AppCard";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { fontFamily } from "../../constants/fonts";
import { colors, motion, spacing, typography, ui } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { buildWeeklyForecast } from "../../lib/forecastEngine";
import { adjustedWeeklyTargetForSignupWeek } from "../../lib/goalPace";
import { progressionLevelName } from "../../lib/progressionLevels";
import { syncProgression } from "../../lib/progressionSync";
import { buildSessionFeedback } from "../../lib/sessionFeedbackEngine";
import { tryParseSessionDto } from "../../lib/sessionDto";
import { tryParseSessionStatsDto } from "../../lib/statsDto";
import { generateMotivationMessage, getTimeOfDay } from "../../lib/motivationEngine";
import { formatDurationWords } from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";
import type { ProgressionDto } from "../../types/outcomes";

const AUTO_RETURN_SECONDS = 10;
const SESSION_XP_MINUTES_FLOOR = 5;
const BASE_SESSION_XP = 5;
const SESSION_XP_PER_MINUTE_AFTER_FLOOR = 0.5;
const SESSION_XP_MAX = 85;
const TRACK_TITLE_MAX_LENGTH = 160;

function estimateSessionXpGain(durationSeconds: number): number {
  const minutes = Math.max(0, Math.floor(durationSeconds / 60));
  if (minutes < SESSION_XP_MINUTES_FLOOR) return 0;
  const scaledMinutes = minutes - SESSION_XP_MINUTES_FLOOR;
  let raw = BASE_SESSION_XP + Math.floor(scaledMinutes * SESSION_XP_PER_MINUTE_AFTER_FLOOR);
  // Keep this mirrored with backend/app/services/progression_service.py::xp_for_completed_session.
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
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RETURN_SECONDS);
  const [autoReturnEnabled, setAutoReturnEnabled] = useState(true);
  const [trackOutcome, setTrackOutcome] = useState<"none" | "wip" | "finished">("none");
  const [trackTitle, setTrackTitle] = useState("");
  const [trackSaveBusy, setTrackSaveBusy] = useState(false);
  const [trackSaved, setTrackSaved] = useState(false);
  const [trackSaveError, setTrackSaveError] = useState<string | null>(null);
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
      setTrackOutcome(
        s.track_outcome === "wip" || s.track_outcome === "finished" || s.track_outcome === "none"
          ? s.track_outcome
          : "none",
      );
      setTrackTitle(s.track_title ?? "");
      setTrackSaved(false);
      setTrackSaveError(null);
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
      setSecondsLeft(AUTO_RETURN_SECONDS);
      setAutoReturnEnabled(true);
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

  useEffect(() => {
    if (loadState !== "ready" || !autoReturnEnabled) return;
    if (secondsLeft <= 0) {
      router.replace("/(tabs)/dashboard");
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((x) => x - 1), 1000);
    return () => clearTimeout(timer);
  }, [autoReturnEnabled, loadState, router, secondsLeft]);

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
  const autoReturnProgress = useMemo(() => {
    const elapsed = AUTO_RETURN_SECONDS - secondsLeft;
    const pct = elapsed / AUTO_RETURN_SECONDS;
    return Math.max(0, Math.min(1, pct));
  }, [secondsLeft]);

  const completionMessage = useMemo(() => {
    if (!session) return null;
    return generateMotivationMessage({
      session: {
        duration_seconds: session.duration_seconds ?? 0,
        focus_score: session.focus_score ?? null,
        session_type: String(session.session_type),
      },
      streak: streak ?? 0,
      todayCount: 0,
      weekCount: 0,
      friends: { activeNow: 0, topThisWeek: null },
      timeOfDay: getTimeOfDay(),
    });
  }, [session, streak]);
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
  const weekdayLabels = useMemo(
    () =>
      (t("common.weekdaysFull", { returnObjects: true }) as string[]) ?? [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
    [t],
  );
  const persistTrackOutcome = useCallback(
    async (nextOutcome: "none" | "wip" | "finished", nextTitle: string) => {
      if (!token || !session?.id) return;
      setAutoReturnEnabled(false);
      setTrackSaveBusy(true);
      setTrackSaveError(null);
      try {
        await apiJson<SessionDto>(`/sessions/item/${session.id}`, {
          token,
          method: "PATCH",
          body: {
            track_outcome: nextOutcome,
            track_title: nextOutcome === "finished" ? nextTitle.trim() || null : null,
          },
        });
        setTrackSaved(true);
      } catch (e) {
        setTrackSaved(false);
        setTrackSaveError(
          e instanceof Error ? e.message : t("sessionComplete.trackSaveErrorFallback"),
        );
      } finally {
        setTrackSaveBusy(false);
      }
    },
    [session?.id, token, t],
  );

  if (loadState === "loading") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.title}>{t("sessionComplete.title")}</Text>
          <Text style={styles.muted}>{t("sessionComplete.loadingSession")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === "error") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Text style={styles.title}>{t("sessionComplete.errorTitle")}</Text>
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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.check}>✓</Text>
          <ScreenHeader
            title={t("sessionComplete.title")}
            subtitle={t("sessionFeedback.nextActionTitle")}
            actionLabel={t("sessionFeedback.backToDashboard")}
            onActionPress={() => router.replace("/(tabs)/dashboard")}
          />
          <Text style={styles.bigDur}>{formatDurationWords(dur)}</Text>
          {streak !== null && streak > 0 ? (
            <View style={[glyphRowStyle, styles.streakRow]}>
              <AppFlame size={22} />
              <Text style={styles.streak}>{t("sessionComplete.streakLine", { count: streak })}</Text>
            </View>
          ) : null}
          <Text style={styles.motivation}>{t(feedback.emotionalMessageKey)}</Text>
        </View>

        <AppCard style={styles.feedbackCard}>
          <Text style={styles.feedbackKicker}>{t("sessionFeedback.progressTitle")}</Text>
          {feedback.progressPercent !== null ? (
            <Text style={styles.feedbackBig}>
              {t("sessionFeedback.progressSecured", { pct: feedback.progressPercent })}
            </Text>
          ) : (
            <Text style={styles.feedbackBig}>{t("sessionFeedback.progressFallback")}</Text>
          )}
          <Text style={styles.feedbackStatus}>{t(feedback.statusMessageKey)}</Text>
          {feedback.remainingSessionsToGoal !== null ? (
            <Text style={styles.feedbackHint}>
              {feedback.remainingSessionsToGoal > 0
                ? t("sessionFeedback.remainingToGoal", {
                    count: feedback.remainingSessionsToGoal,
                  })
                : t("sessionFeedback.goalReached")}
            </Text>
          ) : null}
        </AppCard>

        <AppCard style={styles.nextActionCard}>
          <Text style={styles.nextActionTitle}>{t("sessionFeedback.nextActionTitle")}</Text>
          <Text style={styles.nextActionText}>
            {t(feedback.nextActionKey, feedback.nextActionParams)}
          </Text>
        </AppCard>

        <AppCard style={styles.trackCard}>
          <Text style={styles.nextActionTitle}>{t("sessionComplete.trackOutcomeTitle")}</Text>
          <Text style={styles.trackHint}>{t("sessionComplete.trackOutcomeHint")}</Text>
          <View style={styles.trackOutcomeRow}>
            {(["none", "wip", "finished"] as const).map((option) => (
              <Pressable
                key={option}
                style={({ pressed }) => [
                  styles.trackChip,
                  trackOutcome === option && styles.trackChipActive,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => {
                  setAutoReturnEnabled(false);
                  setTrackOutcome(option);
                  setTrackSaved(false);
                  setTrackSaveError(null);
                  if (option !== "finished") {
                    setTrackTitle("");
                    void persistTrackOutcome(option, "");
                    return;
                  }
                }}
              >
                <Text
                  style={[
                    styles.trackChipText,
                    trackOutcome === option && styles.trackChipTextActive,
                  ]}
                >
                  {option === "none"
                    ? t("sessionComplete.trackOutcomeNone")
                    : option === "wip"
                      ? t("sessionComplete.trackOutcomeWip")
                      : t("sessionComplete.trackOutcomeFinished")}
                </Text>
              </Pressable>
            ))}
          </View>
          {trackOutcome === "finished" ? (
            <View style={styles.trackTitleWrap}>
              <TextInput
                value={trackTitle}
                onChangeText={(value) => {
                  setTrackTitle(value);
                  setTrackSaved(false);
                  setTrackSaveError(null);
                  setAutoReturnEnabled(false);
                }}
                onFocus={() => setAutoReturnEnabled(false)}
                placeholder={t("sessionComplete.trackTitlePlaceholder")}
                placeholderTextColor={colors.textSecondary}
                style={styles.trackTitleInput}
                maxLength={TRACK_TITLE_MAX_LENGTH}
              />
              <Text style={styles.trackCounter}>
                {trackTitle.length}/{TRACK_TITLE_MAX_LENGTH}
              </Text>
              <PrimaryButton
                label={
                  trackSaveBusy
                    ? t("sessionComplete.trackSaveBusy")
                    : t("sessionComplete.trackSaveCta")
                }
                onPress={() => void persistTrackOutcome("finished", trackTitle)}
              />
            </View>
          ) : null}
          {trackSaved ? (
            <Text style={styles.trackSaved}>{t("sessionComplete.trackSaved")}</Text>
          ) : null}
          {trackSaveError ? <Text style={styles.trackError}>{trackSaveError}</Text> : null}
        </AppCard>

        <AppCard style={styles.xpCard}>
          <Text style={styles.xpTitle}>
            {t("sessionComplete.xpEarned", { xp: xpGainEstimate })}
          </Text>
          {xpGainEstimate === 0 ? (
            <Text style={styles.xpHint}>
              {t("sessionComplete.xpMinDurationHint", { min: SESSION_XP_MINUTES_FLOOR })}
            </Text>
          ) : null}
          <Text style={styles.xpMeta}>
            {progression
              ? t("sessionComplete.levelProgress", {
                  name: progressionLevelName(t, progression.current_level),
                  toNext: progression.xp_to_next_level,
                  nextName: progressionLevelName(t, progression.current_level + 1),
                })
              : t("sessionComplete.levelProgressFallback")}
          </Text>
        </AppCard>

        {paceForecast ? (
          <AppCard style={styles.supportingCard}>
            <Text
              style={[
                styles.forecastLine,
                paceForecast.forecastStatus === "will_miss"
                  ? styles.forecastDanger
                  : paceForecast.forecastStatus === "at_risk"
                    ? styles.forecastWarn
                    : styles.forecastGood,
              ]}
            >
              {t(paceForecast.forecastMessageKey, paceForecast.forecastMessageParams)}
            </Text>
            <Text style={styles.forecastHint}>
              {t(paceForecast.todayActionKey, paceForecast.todayActionParams)}
            </Text>
            {paceForecast.projectedHitDayIndex != null &&
            (paceForecast.forecastStatus === "on_track" ||
              paceForecast.forecastStatus === "ahead") ? (
              <Text style={styles.forecastEta}>
                {t("forecast.hitByDay", {
                  day:
                    weekdayLabels[
                      Math.max(0, Math.min(6, paceForecast.projectedHitDayIndex - 1))
                    ] ?? weekdayLabels[0],
                })}
              </Text>
            ) : null}
            <View style={styles.goalProgressTrack}>
              <View
                style={[
                  styles.goalProgressFill,
                  { width: `${paceForecast.currentProgressPercent}%` },
                ]}
              />
              <View
                style={[
                  styles.goalProgressMarker,
                  { left: `${paceForecast.todayExpectedMarkerPercent}%` },
                ]}
              />
            </View>
          </AppCard>
        ) : null}

        {completionMessage ? (
          <Text style={styles.secondaryMotivation}>{completionMessage}</Text>
        ) : null}

        {autoReturnEnabled ? (
          <View style={styles.autoWrap}>
            <Text style={styles.auto}>
              {t("sessionComplete.autoReturn", { seconds: secondsLeft })}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(autoReturnProgress * 100)}%` }]}
              />
            </View>
            <Pressable
              style={({ pressed }) => [styles.stayBtn, pressed && styles.stayBtnPressed]}
              onPress={() => {
                setAutoReturnEnabled(false);
                Haptics.selectionAsync().catch(() => undefined);
              }}
            >
              <Text style={styles.stayBtnLabel}>{t("sessionComplete.stayHere")}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.auto}>{t("sessionComplete.autoReturnCancelled")}</Text>
        )}

        <View style={styles.actions}>
          <PrimaryButton
            label={t("sessionFeedback.planNextSession")}
            onPress={() =>
              router.replace({ pathname: "/session/setup", params: { source: "plan_next" } })
            }
          />
          <SecondaryButton
            label={t("sessionComplete.viewDetails")}
            onPress={() => router.replace(`/session/${id}` as never)}
          />
          <TextButton
            label={t("sessionFeedback.backToDashboard")}
            onPress={() => router.replace("/(tabs)/dashboard")}
            subdued
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
  hero: { alignItems: "stretch", marginTop: spacing.lg, gap: spacing.xs },
  check: {
    fontSize: 48,
    color: colors.success,
    fontFamily: fontFamily.heading,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.screenTitle,
    textAlign: "center",
  },
  muted: { color: colors.textSecondary, ...typography.meta, textAlign: "center" },
  bigDur: {
    color: colors.primary,
    fontFamily: fontFamily.heading,
    fontSize: 36,
    marginTop: spacing.sm,
  },
  streakRow: {
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  streak: {
    color: colors.textSecondary,
    ...typography.meta,
    textAlign: "center",
  },
  feedbackCard: {
    marginTop: spacing.lg,
    width: "100%",
    gap: spacing.xs,
  },
  feedbackKicker: {
    color: colors.textSecondary,
    ...typography.meta,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily: fontFamily.bodyBold,
  },
  feedbackBig: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
  },
  feedbackStatus: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
  },
  feedbackHint: { color: colors.textSecondary, ...typography.meta },
  forecastLine: {
    marginTop: 2,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  forecastHint: { color: colors.textSecondary, ...typography.meta },
  forecastEta: {
    color: colors.textPrimary,
    ...typography.meta,
    fontFamily: fontFamily.bodyMedium,
  },
  forecastDanger: { color: colors.danger },
  forecastWarn: { color: "#f59e0b" },
  forecastGood: { color: colors.success },
  goalProgressTrack: {
    marginTop: spacing.xs,
    width: "100%",
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    position: "relative",
  },
  goalProgressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  goalProgressMarker: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: "#ffffff",
    opacity: 0.9,
  },
  motivation: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
    textAlign: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    lineHeight: 22,
  },
  secondaryMotivation: {
    color: colors.textSecondary,
    ...typography.meta,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  nextActionCard: {
    marginTop: spacing.sm,
    width: "100%",
    gap: spacing.xs,
  },
  nextActionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  nextActionText: {
    color: colors.textSecondary,
    ...typography.body,
    lineHeight: 22,
  },
  trackCard: {
    marginTop: spacing.sm,
    width: "100%",
    gap: spacing.sm,
  },
  trackHint: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  trackOutcomeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  trackChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  trackChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.14)",
  },
  trackChipText: {
    color: colors.textSecondary,
    ...typography.meta,
    fontFamily: fontFamily.bodyBold,
  },
  trackChipTextActive: {
    color: colors.textPrimary,
  },
  trackTitleWrap: {
    gap: spacing.sm,
  },
  trackTitleInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
  },
  trackCounter: {
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "right",
    marginTop: -4,
  },
  trackSaved: {
    color: colors.success,
    ...typography.meta,
    fontFamily: fontFamily.bodyBold,
  },
  trackError: {
    color: colors.danger,
    ...typography.meta,
    fontFamily: fontFamily.bodyMedium,
  },
  xpCard: {
    marginTop: spacing.sm,
    width: "100%",
    gap: spacing.xs,
  },
  xpTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  xpHint: { color: "#f59e0b", ...typography.meta, fontFamily: fontFamily.bodyMedium },
  xpMeta: { color: colors.textSecondary, ...typography.meta },
  auto: { color: colors.textSecondary, ...typography.meta, marginTop: spacing.md },
  supportingCard: {
    marginTop: spacing.sm,
    width: "100%",
    gap: spacing.xs,
  },
  autoWrap: {
    marginTop: spacing.md,
    width: "100%",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  stayBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  stayBtnPressed: {
    opacity: motion.pressOpacity,
    transform: [{ scale: motion.pressScale }],
  },
  stayBtnLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  actions: { marginTop: spacing.xl, gap: spacing.md },
});
