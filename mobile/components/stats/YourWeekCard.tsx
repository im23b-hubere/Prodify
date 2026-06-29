import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppCard } from "../ui/AppCard";
import { PrimaryButton } from "../ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography, ui } from "../../constants/theme";
import { classifyGoalTrackStatus, expectedWeeklySessionsByToday } from "../../lib/goalPace";
import { WEEKDAY_LETTERS, currentWeekDateKeys, localDateKey } from "../../lib/weekCalendar";
import type { CommitmentDto } from "../../types/friends";
import type { GoalCurrentDto } from "../../types/goals";
import type { GoalForecastDto } from "../../types/outcomes";

const GOAL_CHIPS = [3, 5, 7] as const;

type HeatmapDay = { date: string; seconds: number; intensity: number };

type Props = {
  t: TFunction;
  goal: GoalCurrentDto | null;
  forecast: GoalForecastDto | null;
  commitment: CommitmentDto | null;
  heatmapDays: HeatmapDay[];
  configured: boolean;
  busy: boolean;
  hero?: boolean;
  onSaveGoal: (target: number, shareWithFriends: boolean) => Promise<void>;
  onStartSession: () => void;
};

function statusKey(
  goal: GoalCurrentDto | null,
  forecast: GoalForecastDto | null,
  configured: boolean,
): "setup" | "completed" | "behind" | "on_track" {
  if (!goal || !configured) return "setup";
  if (goal.current_sessions >= goal.target_value) return "completed";
  if (forecast) {
    if (forecast.risk_level === "off_track" || forecast.risk_level === "at_risk") return "behind";
    return "on_track";
  }
  const expectedByNow = expectedWeeklySessionsByToday(goal.target_value);
  const track = classifyGoalTrackStatus({
    weeklyGoalTarget: goal.target_value,
    weekSessionsCount: goal.current_sessions,
    expectedByNow,
  });
  if (track === "off_track") return "behind";
  return "on_track";
}

export function YourWeekCard({
  t,
  goal,
  forecast,
  commitment,
  heatmapDays,
  configured,
  busy,
  hero = false,
  onSaveGoal,
  onStartSession,
}: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(5);
  const [customTarget, setCustomTarget] = useState("");
  const [shareWithFriends, setShareWithFriends] = useState(false);

  const weekKeys = useMemo(() => currentWeekDateKeys(), []);
  const activeDayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const day of heatmapDays) {
      if ((day.seconds ?? 0) > 0 || (day.intensity ?? 0) > 0) {
        set.add(day.date);
      }
    }
    return set;
  }, [heatmapDays]);

  const todayKey = useMemo(() => localDateKey(new Date()), []);
  const status = statusKey(goal, forecast, configured);
  const progressPct = goal ? Math.max(0, Math.min(100, Math.round(goal.progress_percent))) : 0;

  const openEditor = (prefill?: number) => {
    const value = prefill ?? goal?.target_value ?? 5;
    setSelectedTarget(value);
    setCustomTarget(GOAL_CHIPS.includes(value as (typeof GOAL_CHIPS)[number]) ? "" : String(value));
    setShareWithFriends(Boolean(commitment));
    setEditorOpen(true);
  };

  const resolveTarget = (): number | null => {
    if (customTarget.trim()) {
      const parsed = Number.parseInt(customTarget, 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 50) return parsed;
      return null;
    }
    return selectedTarget;
  };

  const saveFromEditor = async () => {
    const target = resolveTarget();
    if (target == null) return;
    await onSaveGoal(target, shareWithFriends);
    setEditorOpen(false);
  };

  const saveFromSetup = async (target: number) => {
    await onSaveGoal(target, false);
  };

  const primaryLabel =
    status === "setup"
      ? t("stats.yourWeek.setTargetCta")
      : status === "completed"
        ? t("stats.yourWeek.raiseTargetCta")
        : status === "behind"
          ? t("stats.yourWeek.catchUpCta")
          : t("stats.yourWeek.startSessionCta");

  const primaryAction = () => {
    if (status === "setup") {
      openEditor(5);
      return;
    }
    if (status === "completed") {
      openEditor((goal?.target_value ?? 5) + 1);
      return;
    }
    onStartSession();
  };

  const forecastRiskKey = forecast
    ? forecast.risk_level === "on_track"
      ? "stats.forecastRiskOnTrack"
      : forecast.risk_level === "at_risk"
        ? "stats.forecastRiskAtRisk"
        : "stats.forecastRiskOffTrack"
    : null;

  const nextStepLine = useMemo(() => {
    if (!configured || !goal) return null;
    if (status === "completed") return t("stats.yourWeek.nextStepCompleted");
    if (status === "behind" && forecast?.warning_message) {
      return forecast.warning_message;
    }
    if (forecast && forecast.remaining_sessions > 0) {
      return t("stats.yourWeek.nextStepRemaining", { n: forecast.remaining_sessions });
    }
    return t("stats.yourWeek.nextStepOnTrack");
  }, [configured, goal, status, forecast, t]);

  return (
    <>
      <View testID={hero ? "your-week-hero" : undefined}>
      <AppCard style={[styles.card, hero ? styles.cardHero : undefined]}>
        <Text style={styles.sectionEyebrow}>{t("stats.yourWeek.eyebrow")}</Text>

        {!configured ? (
          <View style={styles.setupWrap}>
            <Text style={[styles.setupTitle, hero && styles.setupTitleHero]}>
              {t("stats.yourWeek.setupTitle")}
            </Text>
            {!hero ? (
              <Text style={styles.setupHint}>{t("stats.yourWeek.setupHint")}</Text>
            ) : null}
            <View style={styles.chipRow}>
              {GOAL_CHIPS.map((n) => (
                <Pressable
                  key={n}
                  style={({ pressed }) => [
                    styles.chip,
                    hero && styles.chipHero,
                    pressed && styles.chipPressed,
                  ]}
                  disabled={busy}
                  onPress={() => void saveFromSetup(n)}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <>
                      <Text style={styles.chipValue}>{n}</Text>
                      <Text style={styles.chipLabel}>{t("stats.yourWeek.sessionsUnit")}</Text>
                    </>
                  )}
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => openEditor(5)} disabled={busy}>
              <Text style={styles.customLink}>{t("stats.yourWeek.customTarget")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.metricRow}>
              <Text style={[styles.bigNumber, hero && styles.bigNumberHero]}>
                {goal?.current_sessions ?? 0}
                <Text style={styles.bigNumberDim}> / {goal?.target_value ?? "—"}</Text>
              </Text>
              <Text style={styles.metricLabel}>{t("stats.yourWeek.sessionsThisWeek")}</Text>
            </View>

            <View
              style={[
                styles.statusPill,
                status === "on_track" && styles.statusOnTrack,
                status === "behind" && styles.statusBehind,
                status === "completed" && styles.statusDone,
              ]}
            >
              <Text style={styles.statusText}>
                {status === "completed"
                  ? t("stats.yourWeek.statusCompleted")
                  : status === "behind"
                    ? t("stats.yourWeek.statusBehind")
                    : t("stats.yourWeek.statusOnTrack")}
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>

            {hero && nextStepLine ? (
              <Text style={styles.nextStep} numberOfLines={2}>
                {nextStepLine}
              </Text>
            ) : null}

            {!hero && forecast && forecastRiskKey ? (
              <Text
                style={[
                  styles.forecastLine,
                  forecast.risk_level === "on_track" && styles.forecastOnTrack,
                  forecast.risk_level === "at_risk" && styles.forecastAtRisk,
                  forecast.risk_level === "off_track" && styles.forecastOffTrack,
                ]}
              >
                {t(forecastRiskKey)} ·{" "}
                {t("stats.forecastRemaining", {
                  n: forecast.remaining_sessions,
                  days: forecast.days_left,
                })}
              </Text>
            ) : null}

            {!hero ? (
              <>
                <Text style={styles.studioLabel}>{t("stats.yourWeek.studioDays")}</Text>
                <View style={styles.dayRow}>
                  {weekKeys.map((key, idx) => {
                    const active = activeDayKeys.has(key);
                    return (
                      <View key={key} style={styles.dayCell}>
                        <View
                          style={[
                            styles.dayDot,
                            active && styles.dayDotActive,
                            key === todayKey && styles.dayDotToday,
                          ]}
                        />
                        <Text style={[styles.dayLetter, active && styles.dayLetterActive]}>
                          {WEEKDAY_LETTERS[idx]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            {!hero && commitment ? (
              <View style={styles.promiseRow}>
                <Text style={styles.promiseText}>
                  {commitment.witness_usernames?.length
                    ? t("stats.yourWeek.sharedWith", {
                        names: commitment.witness_usernames.map((n) => `@${n}`).join(", "),
                      })
                    : t("stats.yourWeek.sharedWithFriends")}
                </Text>
              </View>
            ) : null}

            <PrimaryButton
              label={busy ? t("stats.yourWeek.saving") : primaryLabel}
              onPress={primaryAction}
              disabled={busy}
            />
            {status !== "completed" ? (
              <Pressable onPress={() => openEditor()} disabled={busy} style={styles.editLink}>
                <Text style={styles.editLinkText}>{t("stats.yourWeek.editGoal")}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </AppCard>
      </View>

      <Modal
        visible={editorOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setEditorOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEditorOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("stats.yourWeek.editTitle")}</Text>
            <Text style={styles.modalHint}>{t("stats.yourWeek.editHint")}</Text>
            <View style={styles.chipRow}>
              {GOAL_CHIPS.map((n) => {
                const selected = !customTarget && selectedTarget === n;
                return (
                  <Pressable
                    key={`edit-${n}`}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => {
                      setSelectedTarget(n);
                      setCustomTarget("");
                    }}
                  >
                    <Text style={[styles.chipValue, selected && styles.chipValueSelected]}>
                      {n}
                    </Text>
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                      {t("stats.yourWeek.sessionsUnit")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={customTarget}
              onChangeText={setCustomTarget}
              keyboardType="number-pad"
              placeholder={t("stats.yourWeek.customPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <View style={styles.shareRow}>
              <Text style={styles.shareLabel}>{t("stats.yourWeek.shareToggle")}</Text>
              <Switch
                value={shareWithFriends}
                onValueChange={setShareWithFriends}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
            <PrimaryButton
              label={busy ? t("stats.yourWeek.saving") : t("stats.yourWeek.saveGoal")}
              onPress={() => void saveFromEditor()}
              disabled={busy}
            />
            <Pressable style={styles.modalCancel} onPress={() => setEditorOpen(false)}>
              <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  cardHero: { gap: spacing.xs },
  sectionEyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  setupWrap: { gap: spacing.sm },
  setupTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.cardTitle,
  },
  setupTitleHero: {
    ...typography.body,
    fontFamily: fontFamily.bodyBold,
  },
  setupHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 72,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 2,
  },
  chipHero: {
    minHeight: 52,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  chipPressed: { opacity: 0.88 },
  chipValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 24,
  },
  chipValueSelected: { color: colors.primary },
  chipLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 12,
  },
  chipLabelSelected: { color: colors.textPrimary },
  customLink: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    textDecorationLine: "underline",
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  bigNumber: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 32,
    lineHeight: 38,
  },
  bigNumberHero: {
    fontSize: 28,
    lineHeight: 32,
  },
  bigNumberDim: {
    color: colors.textSecondary,
    fontSize: 22,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    flex: 1,
    textAlign: "right",
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusOnTrack: {
    borderColor: "rgba(34,197,94,0.45)",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  statusBehind: {
    borderColor: "rgba(251,191,36,0.45)",
    backgroundColor: "rgba(251,191,36,0.1)",
  },
  statusDone: {
    borderColor: "rgba(255,61,0,0.45)",
    backgroundColor: "rgba(255,61,0,0.14)",
  },
  statusText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.round,
  },
  forecastLine: {
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  forecastOnTrack: { color: colors.success },
  forecastAtRisk: { color: colors.primary },
  forecastOffTrack: { color: colors.danger },
  nextStep: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    lineHeight: 18,
  },
  studioLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayCell: { alignItems: "center", gap: 4, flex: 1 },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  dayDotActive: {
    backgroundColor: "rgba(255,106,61,0.35)",
    borderColor: "rgba(255,106,61,0.55)",
  },
  dayDotToday: {
    borderColor: colors.primary,
  },
  dayLetter: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 11,
  },
  dayLetterActive: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  promiseRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  promiseText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  editLink: { alignItems: "center", paddingVertical: spacing.xs },
  editLinkText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    textDecorationLine: "underline",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.sectionTitle,
  },
  modalHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  input: {
    minHeight: ui.buttonHeight,
    borderRadius: ui.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    backgroundColor: colors.background,
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  shareLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    ...typography.body,
    flex: 1,
  },
  modalCancel: { alignItems: "center", paddingVertical: spacing.sm },
  modalCancelText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
  },
});
