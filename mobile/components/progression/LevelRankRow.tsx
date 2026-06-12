import { LinearGradient } from "expo-linear-gradient";
import type { TFunction } from "i18next";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { progressionLevelName } from "../../lib/progressionLevels";
import {
  LevelLockedIcon,
  LevelUnlockedIcon,
  levelIconFor,
  levelRankState,
  levelTierFor,
} from "../../lib/progressionLevelTheme";
import type { ProgressionLevelItem } from "../../lib/progressionLevelCatalog";

type Props = {
  entry: ProgressionLevelItem;
  currentLevel: number;
  t: TFunction;
};

export function LevelRankRow({ entry, currentLevel, t }: Props) {
  const state = levelRankState(entry.level, currentLevel);
  const tier = levelTierFor(entry.level);
  const Icon = levelIconFor(entry.level);
  const name = progressionLevelName(t, entry.level);
  const locked = state === "locked";
  const current = state === "current";

  const StatusIcon = locked ? LevelLockedIcon : state === "unlocked" ? LevelUnlockedIcon : null;

  return (
    <View
      style={[
        styles.row,
        { borderColor: locked ? colors.border : tier.accentSoft },
        current && { borderColor: tier.accent, backgroundColor: tier.accentSoft },
        locked && styles.rowLocked,
      ]}
      accessibilityState={{ disabled: locked, selected: current }}
    >
      <View style={[styles.tierBar, { backgroundColor: locked ? colors.border : tier.accent }]} />

      {locked ? (
        <View style={[styles.emblem, styles.emblemLocked]}>
          <Icon size={18} color={colors.textSecondary} strokeWidth={2} />
        </View>
      ) : (
        <LinearGradient
          colors={[...tier.gradient]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={[styles.emblem, current && { shadowColor: tier.glow }]}
        >
          <Icon size={18} color="#fff" strokeWidth={2.2} />
        </LinearGradient>
      )}

      <View style={styles.copy}>
        <Text
          style={[styles.title, locked && styles.titleLocked, current && { color: tier.accent }]}
          numberOfLines={1}
        >
          {t("progression.levelRowLabel", { level: entry.level, name })}
        </Text>
        <Text style={[styles.meta, locked && styles.metaLocked]}>
          {t("progression.levelRowRange", {
            start: entry.xp_start,
            end: entry.xp_end_exclusive - 1,
            span: entry.xp_span,
          })}
        </Text>
      </View>

      <View style={styles.trailing}>
        {current ? (
          <View style={[styles.currentPill, { backgroundColor: tier.accent }]}>
            <Text style={styles.currentPillText}>{t("progression.currentBadge")}</Text>
          </View>
        ) : StatusIcon ? (
          <View
            style={[
              styles.statusIcon,
              locked ? styles.statusLocked : { backgroundColor: tier.accentSoft },
            ]}
          >
            <StatusIcon
              size={14}
              color={locked ? colors.textSecondary : tier.accent}
              strokeWidth={2.4}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    paddingLeft: spacing.xs,
    overflow: "hidden",
  },
  rowLocked: {
    opacity: 0.72,
  },
  tierBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: radii.md,
    borderBottomLeftRadius: radii.md,
  },
  emblem: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
  },
  emblemLocked: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  titleLocked: {
    color: colors.textSecondary,
  },
  meta: {
    color: colors.textSecondary,
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
  },
  metaLocked: {
    opacity: 0.85,
  },
  trailing: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  currentPill: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  currentPillText: {
    color: "#0a0a0a",
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    lineHeight: 12,
  },
  statusIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLocked: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
