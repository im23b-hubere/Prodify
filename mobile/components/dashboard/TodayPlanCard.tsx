import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography, ui } from "../../constants/theme";
import type { ForecastComputed } from "../../lib/forecastEngine";
import type { TodayPlanRecommendation } from "../../lib/todayPlanEngine";
import { AppCard } from "../ui/AppCard";
import { PrimaryButton } from "../ui/PrimaryButton";

type Props = {
  plan: TodayPlanRecommendation;
  forecast: ForecastComputed | null;
  shortSessionsHint?: string | null;
  adjustedTargetHint?: string | null;
  onStartSuggested: () => void;
};

export const TodayPlanCard = memo(function TodayPlanCard({
  plan,
  forecast,
  shortSessionsHint,
  adjustedTargetHint,
  onStartSuggested,
}: Props) {
  const { t } = useTranslation();

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>{t("todayPlan.title")}</Text>
        <View
          style={[
            styles.statusPill,
            plan.status === "off_track"
              ? styles.statusOffTrack
              : plan.status === "ahead"
                ? styles.statusAhead
                : styles.statusOnTrack,
          ]}
        >
          <Text style={styles.statusText}>{t(`todayPlan.status.${plan.status}`)}</Text>
        </View>
      </View>

      <Text style={styles.recommendation}>{t(plan.messageKey, plan.messageParams)}</Text>

      {plan.feedbackPreview ? (
        <Text style={styles.preview}>
          {t("todayPlan.preview", {
            pct: plan.feedbackPreview.weeklyGoalPercentAfterSession,
            state: t(
              plan.feedbackPreview.backOnTrackAfterSuggested
                ? "todayPlan.previewState.backOnTrack"
                : "todayPlan.previewState.progress",
            ),
          })}
        </Text>
      ) : null}
      {shortSessionsHint ? <Text style={styles.shortHint}>{shortSessionsHint}</Text> : null}
      {adjustedTargetHint ? <Text style={styles.adjustedHint}>{adjustedTargetHint}</Text> : null}
      {forecast ? (
        <View style={styles.forecastCard}>
          <Text
            style={[
              styles.forecastLine,
              forecast.forecastStatus === "will_miss"
                ? styles.forecastDanger
                : forecast.forecastStatus === "at_risk"
                  ? styles.forecastWarn
                  : styles.forecastGood,
            ]}
          >
            {t(forecast.forecastMessageKey, forecast.forecastMessageParams)}
          </Text>
          <Text style={styles.forecastHint}>
            {t(forecast.todayActionKey, forecast.todayActionParams)}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${forecast.currentProgressPercent}%` }]} />
            <View
              style={[styles.progressMarker, { left: `${forecast.todayExpectedMarkerPercent}%` }]}
            />
          </View>
        </View>
      ) : null}

      <PrimaryButton label={t("todayPlan.cta")} onPress={onStartSuggested} />
    </AppCard>
  );
});

const styles = StyleSheet.create({
  card: {
    marginTop: ui.stackGap,
    gap: ui.compactGap,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  kicker: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  recommendation: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.cardTitle,
    lineHeight: 22,
  },
  statusPill: {
    borderRadius: radii.round,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
  },
  statusText: {
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  statusOnTrack: {
    borderColor: "rgba(34,197,94,0.45)",
    backgroundColor: "rgba(34,197,94,0.16)",
  },
  statusOffTrack: {
    borderColor: "rgba(239,68,68,0.55)",
    backgroundColor: "rgba(239,68,68,0.16)",
  },
  statusAhead: {
    borderColor: "rgba(96,165,250,0.55)",
    backgroundColor: "rgba(96,165,250,0.16)",
  },
  preview: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  shortHint: {
    color: "#f59e0b",
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  adjustedHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  forecastCard: {
    marginTop: spacing.sm,
    borderRadius: ui.cardRadius,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.01)",
    padding: spacing.sm,
    gap: spacing.xs,
  },
  forecastLine: {
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  forecastHint: {
    color: colors.textSecondary,
    ...typography.meta,
    fontFamily: fontFamily.body,
    opacity: 0.9,
  },
  forecastDanger: { color: colors.danger },
  forecastWarn: { color: "#f59e0b" },
  forecastGood: { color: colors.success },
  progressTrack: {
    marginTop: 2,
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  progressMarker: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: "#ffffff",
    opacity: 0.9,
  },
});
