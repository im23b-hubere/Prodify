import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography, ui } from "../../constants/theme";
import type { TodayPlanRecommendation } from "../../lib/todayPlanEngine";
import { AppCard } from "../ui/AppCard";
import { PrimaryButton } from "../ui/PrimaryButton";

type Props = {
  plan: TodayPlanRecommendation;
  shortSessionsHint?: string | null;
  adjustedTargetHint?: string | null;
  onStartSuggested: () => void;
};

export const TodayPlanCard = memo(function TodayPlanCard({
  plan,
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
});
