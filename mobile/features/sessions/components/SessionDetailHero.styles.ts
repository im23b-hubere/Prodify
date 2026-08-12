import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

export const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.22)",
    overflow: "hidden",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  friendBadge: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(162,89,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.35)",
  },
  friendBadgeText: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    fontSize: 11,
  },
  ownBadge: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(255,61,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.35)",
  },
  ownBadgeText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    fontSize: 11,
  },
  focusBadge: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  focusBadgeText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    fontSize: 11,
  },
  typeLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  duration: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 40,
    lineHeight: 44,
  },
  meta: {
    color: colors.textSecondary,
    ...typography.caption,
    lineHeight: 18,
  },
  trackBlock: {
    marginTop: spacing.xs,
    gap: 2,
  },
  trackLabel: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  trackTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
  },
  activeWrap: {
    marginTop: spacing.sm,
  },
  producerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  producerCopy: {
    flex: 1,
    gap: 2,
  },
  producerName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  producerCta: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    fontSize: 11,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: "rgba(255,255,255,0.12)",
  },
  actionBtnPrimaryText: {
    color: "#fff",
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  actionBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
