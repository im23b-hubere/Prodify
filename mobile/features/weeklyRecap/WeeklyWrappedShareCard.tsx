import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export type WeeklyShareTemplateId = "minimal" | "gradient" | "bold";

type Props = {
  t: (key: string, opts?: Record<string, unknown>) => string;
  template: WeeklyShareTemplateId;
  displaySessions: number;
  displayHours: string;
  currentStreak: number;
  bestStreak: number;
  weekRange?: string;
  topTypeLabel?: string | null;
};

const TEMPLATE_GRADIENTS: Record<WeeklyShareTemplateId, [string, string, string]> = {
  minimal: ["#0a0a0a", "#141414", "#0a0a0a"],
  gradient: ["#1a0a2e", "#ff3d00", "#0a0a0a"],
  bold: ["#ff3d00", "#1a1010", "#0a0a0a"],
};

export function WeeklyWrappedShareCard({
  t,
  template,
  displaySessions,
  displayHours,
  currentStreak,
  bestStreak,
  weekRange,
  topTypeLabel,
}: Props) {
  const subtitle =
    currentStreak >= 7
      ? t("weeklyRecap.shareSubtitleMomentum")
      : currentStreak >= 3
        ? t("weeklyRecap.shareSubtitleStreak")
        : t("weeklyRecap.shareSubtitleDefault");

  return (
    <LinearGradient
      colors={TEMPLATE_GRADIENTS[template]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, template === "bold" && styles.cardBold]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>{t("weeklyRecap.wrappedShareKicker")}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {weekRange ? <Text style={styles.range}>{weekRange}</Text> : null}
      </View>

      <View style={styles.heroBlock}>
        <Text style={styles.heroSessions}>{displaySessions}</Text>
        <Text style={styles.heroSessionsLabel}>{t("weeklyRecap.kpiSessions")}</Text>
        <Text style={styles.heroHours}>{displayHours}h</Text>
        <Text style={styles.heroHoursLabel}>{t("weeklyRecap.kpiHours")}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statPillLabel}>{t("weeklyRecap.kpiCurrentStreak")}</Text>
          <Text style={styles.statPillValue}>{currentStreak}d</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statPillLabel}>{t("weeklyRecap.kpiBestStreak")}</Text>
          <Text style={styles.statPillValue}>{bestStreak}d</Text>
        </View>
      </View>

      {topTypeLabel ? (
        <Text style={styles.topTypeLine}>
          {t("weeklyRecap.wrappedShareTopType", { type: topTypeLabel })}
        </Text>
      ) : null}

      <Text style={styles.footer}>{t("brand")}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 360,
    height: 640,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: spacing.lg,
    gap: spacing.md,
    overflow: "hidden",
  },
  cardBold: {
    borderColor: "rgba(255,255,255,0.2)",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    color: "#fff",
    fontFamily: fontFamily.heading,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  range: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    textAlign: "right",
    maxWidth: 120,
  },
  heroBlock: {
    marginTop: spacing.sm,
    gap: 2,
  },
  heroSessions: {
    color: "#fff",
    fontFamily: fontFamily.heading,
    fontSize: 88,
    lineHeight: 92,
    letterSpacing: -2,
  },
  heroSessionsLabel: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  heroHours: {
    color: colors.success,
    fontFamily: fontFamily.heading,
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1,
  },
  heroHoursLabel: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statPill: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(0,0,0,0.22)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  statPillLabel: {
    color: "rgba(255,255,255,0.68)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statPillValue: {
    color: "#fff",
    fontFamily: fontFamily.heading,
    fontSize: 24,
    lineHeight: 28,
  },
  topTypeLine: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
    marginTop: spacing.xs,
  },
  footer: {
    marginTop: "auto",
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
