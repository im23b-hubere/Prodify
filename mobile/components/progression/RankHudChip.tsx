import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing } from "../../constants/theme";
import { useRankProgression } from "../../hooks/useRankProgression";
import {
  type ProgressionOverviewFrom,
  progressionOverviewHref,
} from "../../lib/progressionNavigation";

const CHIP_MAX_WIDTH = 108;

function shortenLabel(value: string, max = 12): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}

type Props = {
  from: ProgressionOverviewFrom;
  enabled?: boolean;
};

export function RankHudChip({ from, enabled = true }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { ready, level, progressPercent, rankName } = useRankProgression(enabled);

  if (!ready || level == null) return null;

  const shortRank = shortenLabel(rankName);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("progression.xpHudA11y", { name: rankName })}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        router.push(progressionOverviewHref(from));
      }}
    >
      <View style={styles.levelBadge}>
        <Text style={styles.levelBadgeText}>{level}</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.rankLine} numberOfLines={1}>
          {shortRank}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progressPercent}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: CHIP_MAX_WIDTH,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  levelBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,61,0,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.35)",
  },
  levelBadgeText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    lineHeight: 14,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rankLine: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    lineHeight: 12,
  },
  track: {
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
});
