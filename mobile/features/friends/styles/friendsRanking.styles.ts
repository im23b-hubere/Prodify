import { StyleSheet } from "react-native";

import { listStyles } from "../../../components/ui/list/listStyles";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

const ACCENT_TINT = "rgba(255,61,0,0.12)";

const rankingStyles = StyleSheet.create({
  standing: { gap: spacing.lg },

  hero: { padding: spacing.lg, gap: spacing.md },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.round,
    backgroundColor: ACCENT_TINT,
  },
  streakChipText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  positionRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  position: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2,
  },
  positionOf: {
    color: colors.textSecondary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  chase: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    marginTop: -spacing.xs,
  },
  chaseAccent: { color: colors.primary },
  heroAction: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

  periodSwitch: { width: 152 },

  rankPosition: {
    width: 20,
    textAlign: "center",
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  rankPositionYou: { color: colors.primary },
  rankScore: { alignItems: "flex-end", minWidth: 56 },
  rankScoreValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  rankScoreValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 18,
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
  },
  rankScoreUnit: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
  },
  rankDivider: { left: 108 },
  showMore: { minHeight: 52, alignItems: "center", justifyContent: "center" },
  showMoreDivider: { left: 0 },
});

export const friendsRankingStyles = { ...listStyles, ...rankingStyles };
