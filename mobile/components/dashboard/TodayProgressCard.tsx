import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  todaySessions: number;
  todayMinutes: number;
  onViewWeekInStats?: () => void;
};

export const TodayProgressCard = memo(function TodayProgressCard({
  todaySessions,
  todayMinutes,
  onViewWeekInStats,
}: Props) {
  const { t } = useTranslation();

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
      {onViewWeekInStats ? (
        <Pressable
          accessibilityRole="button"
          onPress={onViewWeekInStats}
          style={({ pressed }) => [styles.weekLink, pressed && styles.weekLinkPressed]}
        >
          <Text style={styles.weekLinkText}>{t("dashboard.viewWeekInStats")}</Text>
        </Pressable>
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
  weekLink: { alignSelf: "center", paddingVertical: spacing.xs },
  weekLinkPressed: { opacity: 0.75 },
  weekLinkText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
});
