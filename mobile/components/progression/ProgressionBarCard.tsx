import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { fontFamily } from "../../constants/fonts";
import { progressionLevelName } from "../../lib/progressionLevels";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { ProgressionDto } from "../../types/outcomes";

type Props = {
  progression: ProgressionDto | null;
  loading?: boolean;
  onPress?: () => void;
};

export const ProgressionBarCard = memo(function ProgressionBarCard({
  progression,
  loading = false,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const level = progression?.current_level;
  const nextLevel = level != null ? level + 1 : null;
  const rankName = useMemo(
    () => (level != null ? progressionLevelName(t, level) : ""),
    [level, t],
  );
  const nextRankName = useMemo(
    () => (nextLevel != null ? progressionLevelName(t, nextLevel) : ""),
    [nextLevel, t],
  );

  if (loading) {
    return (
      <View style={styles.card} testID="progression-bar-loading">
        <Text style={styles.sub}>{t("progression.loading")}</Text>
      </View>
    );
  }

  if (!progression) {
    return (
      <View style={styles.card} testID="progression-bar-unavailable">
        <Text style={styles.sub}>{t("progression.loadError")}</Text>
      </View>
    );
  }

  const xp = progression.xp_total;
  const xpToNext = progression.xp_to_next_level;
  const pct = Math.max(0, Math.min(100, progression.progress_percent));

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [styles.card, onPress && pressed && styles.cardPressed]}
      onPress={onPress}
      disabled={!onPress}
      testID="progression-bar-ready"
    >
      <View style={styles.row}>
        <Text style={styles.title}>
          {t("progression.levelTitle", { level: progression.current_level, name: rankName })}
        </Text>
        <Text style={styles.sub}>{t("progression.xpTotal", { xp })}</Text>
      </View>
      <Text style={styles.hint}>{t("progression.hint")}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.sub}>
        {t("progression.toNext", {
          xp: xpToNext,
          nextName: nextRankName,
          percent: Math.round(pct),
        })}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.subheadline },
  hint: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  sub: { color: colors.textSecondary, ...typography.caption },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.primary },
});
