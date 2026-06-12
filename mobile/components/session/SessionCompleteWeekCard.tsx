import type { TFunction } from "i18next";
import { StyleSheet, Text, View } from "react-native";

import { AppCard } from "../ui/AppCard";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { ForecastComputed } from "../../lib/forecastEngine";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";

type Props = {
  t: TFunction;
  feedback: SessionFeedbackComputed;
  weekSessionsCount: number;
  weeklyGoalTarget: number | null;
  paceForecast: ForecastComputed | null;
  weekdayLabels: string[];
};

export function SessionCompleteWeekCard({
  t,
  feedback,
  weekSessionsCount,
  weeklyGoalTarget,
  paceForecast,
  weekdayLabels,
}: Props) {
  const hasGoal = weeklyGoalTarget != null && weeklyGoalTarget > 0;
  const progressPct = paceForecast?.currentProgressPercent ?? feedback.progressPercent ?? 0;

  const forecastTone =
    paceForecast?.forecastStatus === "will_miss"
      ? styles.forecastDanger
      : paceForecast?.forecastStatus === "at_risk"
        ? styles.forecastWarn
        : paceForecast
          ? styles.forecastGood
          : null;

  return (
    <AppCard style={styles.card}>
      <Text style={styles.title}>{t("sessionComplete.weekCardTitle")}</Text>

      {hasGoal ? (
        <>
          <Text style={styles.progressLabel}>
            {t("sessionComplete.weekProgress", {
              current: weekSessionsCount,
              target: weeklyGoalTarget,
            })}
          </Text>
          <View style={styles.goalProgressTrack}>
            <View style={[styles.goalProgressFill, { width: `${progressPct}%` }]} />
            {paceForecast ? (
              <View
                style={[
                  styles.goalProgressMarker,
                  { left: `${paceForecast.todayExpectedMarkerPercent}%` },
                ]}
              />
            ) : null}
          </View>
        </>
      ) : (
        <Text style={styles.progressFallback}>{t("sessionFeedback.progressFallback")}</Text>
      )}

      <Text style={styles.nextAction}>{t(feedback.nextActionKey, feedback.nextActionParams)}</Text>

      {paceForecast ? (
        <Text style={[styles.forecastLine, forecastTone]}>
          {t(paceForecast.forecastMessageKey, paceForecast.forecastMessageParams)}
        </Text>
      ) : feedback.remainingSessionsToGoal != null && hasGoal ? (
        <Text style={styles.forecastLine}>
          {feedback.remainingSessionsToGoal > 0
            ? t("sessionFeedback.remainingToGoal", { count: feedback.remainingSessionsToGoal })
            : t("sessionFeedback.goalReached")}
        </Text>
      ) : null}

      {paceForecast?.projectedHitDayIndex != null &&
      (paceForecast.forecastStatus === "on_track" || paceForecast.forecastStatus === "ahead") ? (
        <Text style={styles.forecastEta}>
          {t("forecast.hitByDay", {
            day:
              weekdayLabels[Math.max(0, Math.min(6, paceForecast.projectedHitDayIndex - 1))] ??
              weekdayLabels[0],
          })}
        </Text>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    width: "100%",
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  progressLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 22,
    lineHeight: 28,
  },
  progressFallback: {
    color: colors.textSecondary,
    ...typography.body,
  },
  goalProgressTrack: {
    width: "100%",
    height: 9,
    borderRadius: radii.round,
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
  nextAction: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
    lineHeight: 22,
  },
  forecastLine: {
    color: colors.textSecondary,
    ...typography.meta,
    fontFamily: fontFamily.bodyMedium,
  },
  forecastEta: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  forecastDanger: { color: colors.danger },
  forecastWarn: { color: "#f59e0b" },
  forecastGood: { color: colors.success },
});
