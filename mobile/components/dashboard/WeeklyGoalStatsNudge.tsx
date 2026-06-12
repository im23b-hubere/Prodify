import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { AppCard } from "../ui/AppCard";
import { PrimaryButton } from "../ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography, ui } from "../../constants/theme";

type Props = {
  onOpenStats: () => void;
};

export const WeeklyGoalStatsNudge = memo(function WeeklyGoalStatsNudge({ onOpenStats }: Props) {
  const { t } = useTranslation();

  return (
    <View testID="weekly-goal-stats-nudge">
      <AppCard style={styles.card}>
        <View style={styles.copy}>
          <Text style={styles.title}>{t("dashboard.weeklyGoalNudgeTitle")}</Text>
          <Text style={styles.body}>{t("dashboard.weeklyGoalNudgeBody")}</Text>
        </View>
        <PrimaryButton label={t("dashboard.weeklyGoalNudgeCta")} onPress={onOpenStats} />
      </AppCard>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginTop: ui.stackGap,
    gap: ui.compactGap,
  },
  copy: { gap: spacing.xs },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
});
