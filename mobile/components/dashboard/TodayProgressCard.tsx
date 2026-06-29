import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  todaySessions: number;
  todayMinutes: number;
  compact?: boolean;
};

export const TodayProgressCard = memo(function TodayProgressCard({
  todaySessions,
  todayMinutes,
  compact = false,
}: Props) {
  const { t } = useTranslation();

  if (compact) {
    return (
      <View style={styles.compactRow} testID="today-progress-compact">
        <Text style={styles.compactText}>
          {t("todayProgress.compactSummary", { sessions: todaySessions, minutes: todayMinutes })}
        </Text>
      </View>
    );
  }

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
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  compactRow: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
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
});
