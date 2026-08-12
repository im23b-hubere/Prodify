import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { friendsSharedStyles } from "./friendsShared.styles";

const localStyles = StyleSheet.create({
  activityCountPill: {
    minWidth: 28,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  activityCountText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  activityFeedStack: { gap: spacing.md },
  emptyLeader: {
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  leaderDivider: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#202020",
  },
  leaderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
    paddingHorizontal: 6,
  },
  leaderMetricLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  leaderMetricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radii.round,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  leaderMetricValue: {
    color: colors.textPrimary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  leaderMetricsRow: {
    marginTop: 4,
    flexDirection: "row",
    gap: 6,
  },
  leaderTopRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  periodChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  periodChipActive: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.2)" },
  periodChipText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  periodChipTextActive: { color: colors.textPrimary },
  periodToggle: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    justifyContent: "flex-end",
  },
  rankNumber: {
    minWidth: 24,
    textAlign: "center",
    marginRight: 2,
    color: colors.textSecondary,
    ...typography.body,
  },
  rankNumberRegular: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    opacity: 0.9,
  },
  triggerCardPrimary: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: spacing.sm,
    backgroundColor: "rgba(255,61,0,0.12)",
    gap: spacing.xs,
  },
  userCopy: { flex: 1 },
});

export const friendsOverviewStyles = { ...friendsSharedStyles, ...localStyles };
