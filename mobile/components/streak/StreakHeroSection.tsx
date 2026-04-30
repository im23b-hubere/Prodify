import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Shield } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useAnimatedStreakCount } from "../../hooks/useAnimatedStreakCount";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";
import type { StreakOverviewDto } from "../../types/streak";

type WeekDotKind = "none" | "session" | "freeze";

type StreakHeroSectionProps = {
  overview: StreakOverviewDto | null;
  loading: boolean;
  freezeBusy: boolean;
  onUseFreeze: () => void;
  onFreezeUnavailable?: () => void;
  onOpenHistory?: () => void;
};

export function StreakHeroSection({
  overview,
  loading,
  freezeBusy,
  onUseFreeze,
  onFreezeUnavailable,
  onOpenHistory,
}: StreakHeroSectionProps) {
  const { t } = useTranslation();
  const target = overview?.current_streak ?? 0;
  const displayStreak = useAnimatedStreakCount(target, 900);

  if (loading && !overview) {
    return (
      <View style={styles.skeleton}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!overview) return null;

  const kinds: WeekDotKind[] = (overview.last_7_day_states ?? []) as WeekDotKind[];
  const labels = overview.last_7_day_labels ?? [];
  const weekItems = labels.length === 7 ? labels.map((label, index) => ({ label, index })) : [];

  const nextLine =
    overview.next_milestone_at != null &&
    overview.days_to_next_milestone != null &&
    overview.next_milestone_title != null
      ? t("streakHero.nextMilestone", {
          count: overview.days_to_next_milestone,
          title: overview.next_milestone_title,
          days: overview.days_to_next_milestone,
        })
      : t("streakHero.topTier");

  return (
    <Animated.View entering={FadeInDown.duration(420)}>
      <LinearGradient colors={["#1f1410", "#141414"]} style={styles.card}>
        <Text style={styles.streakKicker}>{t("streakHero.kicker")}</Text>
        <View style={styles.topRow}>
          <Text style={styles.flameEmoji}>🔥</Text>
          <Text style={styles.bigStreak}>{displayStreak}</Text>
          <Text style={styles.dayWord}>{t("streakHero.dayStreak")}</Text>
        </View>
        <Text style={styles.tagline}>{overview.tagline}</Text>

        {kinds.length === 7 && weekItems.length === 7 ? (
          <View style={styles.weekProgress}>
            {weekItems.map(({ label, index }) => {
              const kind = kinds[index] ?? "none";
              const isToday = index === 6;
              return (
                <View key={`${label}-${index}`} style={styles.dayColumn}>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                    {label.slice(0, 1)}
                  </Text>
                  <View
                    style={[
                      styles.dayDot,
                      kind === "session" && styles.dayDotSession,
                      kind === "freeze" && styles.dayDotFreeze,
                      isToday && styles.dayDotToday,
                    ]}
                  />
                </View>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.milestoneHint}>{nextLine}</Text>
        <Text style={styles.longest}>
          {t("streakHero.longest", { days: overview.longest_streak })}
        </Text>

        {onOpenHistory ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("streakHero.historyA11y")}
            style={({ pressed }) => [styles.historyLink, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onOpenHistory();
            }}
          >
            <Text style={styles.historyLinkText}>{t("streakHero.historyLink")}</Text>
            <ChevronRight color={colors.secondary} size={18} />
          </Pressable>
        ) : null}

        {overview.streak_at_risk ? (
          <View style={styles.riskBanner}>
            <Text style={styles.riskTxt}>{t("streakHero.riskBanner")}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.freezeBtn,
            (!overview.can_use_freeze || freezeBusy) && styles.freezeDisabled,
            pressed && overview.can_use_freeze && !freezeBusy && { opacity: 0.9 },
          ]}
          onPress={() => {
            if (!overview.can_use_freeze || freezeBusy) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
                () => undefined,
              );
              onFreezeUnavailable?.();
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
            onUseFreeze();
          }}
        >
          <Shield
            color={overview.can_use_freeze ? colors.secondary : colors.textSecondary}
            size={20}
          />
          <Text style={styles.freezeLabel}>
            {freezeBusy
              ? t("streakHero.freezeActivating")
              : overview.freezes_remaining > 0
                ? t("streakHero.freezeAvailable", { n: overview.freezes_remaining })
                : t("streakHero.freezeNone")}
          </Text>
        </Pressable>
        {!overview.can_use_freeze && overview.freezes_remaining < 1 ? (
          <Text style={styles.freezeHint}>{t("streakHero.freezeHint")}</Text>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    minHeight: 200,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  streakKicker: {
    color: colors.textSecondary,
    ...typography.meta,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
    marginBottom: spacing.xs,
    fontFamily: fontFamily.bodyBold,
  },
  flameEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  bigStreak: {
    fontSize: 56,
    lineHeight: 58,
    fontFamily: fontFamily.heading,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  dayWord: {
    fontSize: 18,
    fontFamily: fontFamily.heading,
    color: colors.textPrimary,
    letterSpacing: 2,
    marginBottom: 6,
  },
  tagline: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: "center",
    marginBottom: spacing.md,
    fontFamily: fontFamily.bodyMedium,
  },
  weekProgress: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayColumn: {
    width: 24,
    alignItems: "center",
    gap: 6,
  },
  dayLabel: {
    textAlign: "center",
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fontFamily.bodyMedium,
  },
  dayLabelToday: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  dayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  dayDotSession: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayDotFreeze: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  dayDotToday: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  milestoneHint: {
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  longest: {
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
    marginTop: 4,
  },
  historyLink: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  historyLinkText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  riskBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,139,0,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,139,0,0.45)",
  },
  riskTxt: {
    color: "#ffd28e",
    ...typography.caption,
    textAlign: "center",
    fontFamily: fontFamily.bodyBold,
  },
  freezeBtn: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.45)",
    backgroundColor: "rgba(162,89,255,0.1)",
  },
  freezeDisabled: {
    opacity: 0.55,
  },
  freezeLabel: {
    color: colors.textPrimary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
    flex: 1,
  },
  freezeHint: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: "center",
  },
});
