import type { TFunction } from "i18next";
import { StyleSheet, Text, View } from "react-native";

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
};

type QuestStatus = "goalComplete" | "ahead" | "onTrack" | "atRisk" | "offTrack";

function resolveQuestStatus(
  feedback: SessionFeedbackComputed,
  paceForecast: ForecastComputed | null,
): QuestStatus {
  if (feedback.remainingSessionsToGoal === 0) return "goalComplete";
  if (paceForecast?.forecastStatus === "ahead") return "ahead";
  if (paceForecast?.forecastStatus === "at_risk" || paceForecast?.forecastStatus === "will_miss") {
    return "atRisk";
  }
  if (feedback.newStatus === "off_track") return "offTrack";
  return "onTrack";
}

export function SessionCompleteWeekCard({
  t,
  feedback,
  weekSessionsCount,
  weeklyGoalTarget,
  paceForecast,
}: Props) {
  const hasGoal = weeklyGoalTarget != null && weeklyGoalTarget > 0;
  const progressPct = paceForecast?.currentProgressPercent ?? feedback.progressPercent ?? 0;
  const questStatus = resolveQuestStatus(feedback, paceForecast);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("sessionComplete.weekQuestTitle")}</Text>
        {hasGoal ? (
          <View style={[styles.statusChip, styles[`chip_${questStatus}`]]}>
            <Text style={styles.statusChipText}>{t(`sessionComplete.questStatus.${questStatus}`)}</Text>
          </View>
        ) : null}
      </View>

      {hasGoal ? (
        <>
          <Text style={styles.progressNumbers}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    width: "100%",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  title: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statusChip: {
    borderRadius: radii.round,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusChipText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  chip_goalComplete: {
    borderColor: "rgba(0,255,136,0.45)",
    backgroundColor: "rgba(0,255,136,0.12)",
  },
  chip_ahead: {
    borderColor: "rgba(0,255,136,0.35)",
    backgroundColor: "rgba(0,255,136,0.08)",
  },
  chip_onTrack: {
    borderColor: "rgba(162,89,255,0.4)",
    backgroundColor: "rgba(162,89,255,0.12)",
  },
  chip_atRisk: {
    borderColor: "rgba(245,158,11,0.45)",
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  chip_offTrack: {
    borderColor: "rgba(255,68,68,0.4)",
    backgroundColor: "rgba(255,68,68,0.1)",
  },
  progressNumbers: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  progressFallback: {
    color: colors.textSecondary,
    ...typography.body,
  },
  goalProgressTrack: {
    width: "100%",
    height: 10,
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
    opacity: 0.85,
  },
});
