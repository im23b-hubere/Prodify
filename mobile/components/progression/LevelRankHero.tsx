import { LinearGradient } from "expo-linear-gradient";
import type { TFunction } from "i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { progressionLevelName } from "../../lib/progressionLevels";
import { levelIconFor, levelTierFor } from "../../lib/progressionLevelTheme";

type Props = {
  level: number;
  t: TFunction;
};

export function LevelRankHeroEmblem({ level, t }: Props) {
  const tier = levelTierFor(level);
  const Icon = levelIconFor(level);
  const name = progressionLevelName(t, level);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[...tier.gradient]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={[styles.emblem, { shadowColor: tier.glow }]}
      >
        <Icon size={28} color="#fff" strokeWidth={2.2} />
      </LinearGradient>
      <View style={styles.copy}>
        <Text style={[styles.tierLabel, { color: tier.accent }]}>{t(tier.labelKey)}</Text>
        <Text style={styles.rankName}>{name}</Text>
        <Text style={styles.levelLine}>{t("progression.xpHudLevelShort", { level })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  emblem: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 14,
    elevation: 6,
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
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  rankName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 22,
    lineHeight: 26,
  },
  levelLine: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
