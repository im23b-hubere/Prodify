import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { GoalForecastDto } from "../../types/outcomes";

type Props = {
  todaySessions: number;
  todayMinutes: number;
  weekSessions: number;
  weekGoalTarget: number | null;
  goalForecast?: GoalForecastDto | null;
};

export const TodayProgressCard = memo(function TodayProgressCard({
  todaySessions,
  todayMinutes,
  weekSessions,
  weekGoalTarget,
  goalForecast,
}: Props) {
  const { t } = useTranslation();
  const goalLine =
    weekGoalTarget != null && weekGoalTarget > 0
      ? t("todayProgress.weekGoal", { current: weekSessions, goal: weekGoalTarget })
      : t("todayProgress.weekOnly", { count: weekSessions });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("todayProgress.title")}</Text>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.big}>{todaySessions}</Text>
          <Text style={styles.lbl}>{t("todayProgress.sessions")}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.cell}>
          <Text style={styles.big}>{todayMinutes}</Text>
          <Text style={styles.lbl}>{t("todayProgress.minutes")}</Text>
        </View>
      </View>
      <Text style={styles.week}>{goalLine}</Text>
      {goalForecast ? (
        <Text
          style={[
            styles.week,
            goalForecast.risk_level === "off_track"
              ? styles.riskHigh
              : goalForecast.risk_level === "at_risk"
                ? styles.riskMid
                : null,
          ]}
        >
          {goalForecast.warning_message}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", alignItems: "center" },
  cell: { flex: 1, alignItems: "center", gap: 4 },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border },
  big: { fontSize: 28, fontFamily: fontFamily.heading, color: colors.textPrimary },
  lbl: { color: colors.textSecondary, ...typography.caption },
  week: { color: colors.textSecondary, ...typography.caption, textAlign: "center" },
  riskMid: { color: "#eab308" },
  riskHigh: { color: colors.danger },
});
