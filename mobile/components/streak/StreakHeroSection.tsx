import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Shield } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { WeekProgressDots, type WeekDotKind } from "../ui/WeekProgressDots";
import { useAnimatedStreakCount } from "../../hooks/useAnimatedStreakCount";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";
import type { StreakOverviewDto } from "../../types/streak";

type StreakHeroSectionProps = {
  overview: StreakOverviewDto | null;
  loading: boolean;
  freezeBusy: boolean;
  onUseFreeze: () => void;
  onOpenHistory?: () => void;
};

export function StreakHeroSection({
  overview,
  loading,
  freezeBusy,
  onUseFreeze,
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
        <View style={styles.topRow}>
          <Text style={styles.flameEmoji}>🔥</Text>
          <Text style={styles.bigStreak}>{displayStreak}</Text>
          <Text style={styles.dayWord}>{t("streakHero.dayStreak")}</Text>
        </View>
        <Text style={styles.tagline}>{overview.tagline}</Text>

        <WeekProgressDots dayKinds={kinds.length === 7 ? kinds : undefined} />

        {labels.length === 7 ? (
          <View style={styles.weekLabels}>
            {labels.map((L, i) => (
              <Text key={i} style={styles.wd}>
                {L}
              </Text>
            ))}
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
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
            onUseFreeze();
          }}
          disabled={!overview.can_use_freeze || freezeBusy}
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
  weekLabels: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  wd: {
    width: 20,
    textAlign: "center",
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fontFamily.bodyMedium,
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
    backgroundColor: "rgba(255,170,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,170,0,0.35)",
  },
  riskTxt: {
    color: "#ffcc66",
    ...typography.caption,
    textAlign: "center",
    fontFamily: fontFamily.bodyMedium,
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
