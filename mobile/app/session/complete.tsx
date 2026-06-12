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
import { SessionCompleteWeekCard } from "../../components/session/SessionCompleteWeekCard";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { TextButton } from "../../components/ui/TextButton";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { AppCard } from "../../components/ui/AppCard";
import { fontFamily } from "../../constants/fonts";
import { colors, motion, spacing, typography, ui } from "../../constants/theme";
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
import { tryParseSessionDto } from "../../lib/sessionDto";
import { tryParseSessionStatsDto } from "../../lib/statsDto";
import { formatDurationWords } from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";
import type { ProgressionDto } from "../../types/outcomes";

const AUTO_RETURN_SECONDS = 10;
const SESSION_XP_MINUTES_FLOOR = 5;
const BASE_SESSION_XP = 5;
const SESSION_XP_PER_MINUTE_AFTER_FLOOR = 0.5;
const SESSION_XP_MAX = 85;
const TRACK_TITLE_MAX_LENGTH = 160;

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
          <Text style={styles.title}>{t("sessionComplete.title")}</Text>
          <Text style={styles.bigDur}>{formatDurationWords(dur)}</Text>
          <View style={styles.statRow}>
            {streak !== null && streak > 0 ? (
              <>
                <View style={[glyphRowStyle, styles.statChip]}>
                  <AppFlame size={16} />
                  <Text style={styles.statItem}>
                    {t("sessionComplete.statStreak", { count: streak })}
                  </Text>
                </View>
                <Text style={styles.statDot}>·</Text>
              </>
            ) : null}
            <Text style={styles.statItem}>
              {t("sessionComplete.statXp", { xp: xpGainEstimate })}
            </Text>
            {progression ? (
              <>
                <Text style={styles.statDot}>·</Text>
                <Text style={styles.statItem} numberOfLines={1}>
                  {t("sessionComplete.statRank", {
                    level: progression.current_level,
                    name: shortenLabel(progressionLevelName(t, progression.current_level)),
                  })}
                </Text>
              </>
            ) : null}
          </View>
          {xpGainEstimate === 0 ? (
            <Text style={styles.xpHintInline}>
              {t("sessionComplete.xpMinDurationHint", { min: SESSION_XP_MINUTES_FLOOR })}
            </Text>
          ) : null}
          <Text style={styles.motivation}>{t(pickSessionHighlightKey(feedback))}</Text>
        </View>

        <SessionCompleteWeekCard
          t={t}
          feedback={feedback}
          weekSessionsCount={weekSessionsCount}
          weeklyGoalTarget={effectiveWeeklyGoalTarget}
          paceForecast={paceForecast}
          weekdayLabels={weekdayLabels}
        />

        <AppCard style={styles.trackCard}>
          <Text style={styles.cardTitle}>{t("sessionComplete.trackOutcomeTitle")}</Text>
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
  hero: { alignItems: "center", marginTop: spacing.lg, gap: spacing.xs },
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
    marginTop: spacing.xs,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  statChip: {
    alignItems: "center",
  },
  statItem: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  statDot: {
    color: colors.textSecondary,
    ...typography.meta,
    opacity: 0.6,
  },
  xpHintInline: {
    color: "#f59e0b",
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  motivation: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
    textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    lineHeight: 22,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  trackCard: {
    marginTop: spacing.sm,
    width: "100%",
    gap: spacing.sm,
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
  auto: { color: colors.textSecondary, ...typography.meta, marginTop: spacing.md },
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
