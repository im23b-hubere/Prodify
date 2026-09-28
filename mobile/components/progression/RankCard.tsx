import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Trophy } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useRankProgression } from "../../hooks/useRankProgression";
import { PROGRESSION_NAMED_LEVEL_MAX } from "../../lib/progressionLevels";
import { levelTierFor } from "../../lib/progressionLevelTheme";
import { AppCard } from "../ui/AppCard";
import { RankArt } from "./RankArt";

const EMBLEM_SIZE = 64;

type Props = {
  onPress: () => void;
  testID?: string;
};

/** Full-width rank card: tier emblem, rank name, and XP progress toward the next rank. */
export function RankCard({ onPress, testID }: Props) {
  const { t } = useTranslation();
  const { ready, level, progressPercent, xpToNext, rankName, nextRankName } = useRankProgression();

  if (!ready || level == null) {
    // Same footprint as the loaded card so the profile does not jump when XP arrives.
    return (
      <AppCard style={styles.card} onPress={onPress} testID={testID}>
        <View style={styles.headRow}>
          <View style={[styles.emblem, styles.emblemPlaceholder]}>
            <Trophy color={colors.textSecondary} size={24} strokeWidth={2.2} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rankName}>{t("progression.overviewTitle")}</Text>
            <View style={styles.skeletonLine} />
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </View>
        <View style={styles.track} />
      </AppCard>
    );
  }

  const tier = levelTierFor(level);
  const maxed = level >= PROGRESSION_NAMED_LEVEL_MAX;
  const percent = maxed ? 100 : Math.round(progressPercent);

  return (
    <AppCard
      style={[styles.card, { borderColor: tier.accentSoft }]}
      onPress={onPress}
      testID={testID}
    >
      <LinearGradient
        colors={[tier.accentSoft, "rgba(0,0,0,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.headRow}>
        <View>
          <View style={[styles.emblem, { shadowColor: tier.glow }]}>
            <RankArt level={level} size={EMBLEM_SIZE} />
          </View>
          <View style={[styles.levelNotch, { backgroundColor: tier.accent }]}>
            <Text style={styles.levelNotchText}>{t("progression.xpHudLevelShort", { level })}</Text>
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={[styles.tierLabel, { color: tier.accent }]}>{t(tier.labelKey)}</Text>
          <Text style={styles.rankName} numberOfLines={2}>
            {rankName}
          </Text>
        </View>

        <ChevronRight color={colors.textSecondary} size={20} />
      </View>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <LinearGradient
          colors={[tier.gradient[1], tier.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${percent}%` }]}
        />
      </View>

      <View style={styles.footRow}>
        <Text style={styles.footText} numberOfLines={1}>
          {maxed
            ? t("progression.maxRank")
            : t("progression.xpHudToNext", { xp: xpToNext ?? 0, nextName: nextRankName })}
        </Text>
        {maxed ? null : (
          <Text style={[styles.footPercent, { color: tier.accent }]}>{percent}%</Text>
        )}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  emblem: {
    width: EMBLEM_SIZE,
    height: EMBLEM_SIZE,
    borderRadius: EMBLEM_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 12,
    elevation: 6,
  },
  emblemPlaceholder: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelNotch: {
    position: "absolute",
    bottom: -7,
    alignSelf: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.round,
    borderWidth: 2,
    // Matches the card surface so the notch reads as cut out of the emblem.
    borderColor: colors.surface,
  },
  levelNotchText: {
    color: "#0a0a0a",
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    lineHeight: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  tierLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  rankName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
  },
  skeletonLine: {
    width: "55%",
    height: 12,
    marginTop: 4,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  track: {
    height: 8,
    borderRadius: radii.round,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radii.round,
  },
  footRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: -spacing.xs,
  },
  footText: {
    flex: 1,
    color: colors.textSecondary,
    ...typography.caption,
  },
  footPercent: {
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
