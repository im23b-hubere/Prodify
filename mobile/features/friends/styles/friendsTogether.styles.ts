import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../../constants/theme";
import { friendsSharedStyles } from "./friendsShared.styles";

const localStyles = StyleSheet.create({
  challengeBlock: {
    width: "100%",
    gap: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: spacing.sm,
  },
  challengeHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  challengeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  challengeKindPill: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  challengeKindPillText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
    textTransform: "capitalize",
  },
  challengeTapCard: {
    gap: spacing.xs,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  challengeTapCardPressed: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  challengeTapHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 12,
    opacity: 0.85,
  },
  collapseBadge: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  collapseBadgeText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  secondaryBtn: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    textAlign: "center",
  },
  togetherGetStartedCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  togetherGetStartedTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
    lineHeight: 22,
    textAlign: "center",
  },
  togetherOrDivider: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    textAlign: "center",
  },
  togetherSecondaryFull: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
});

export const friendsTogetherStyles = { ...friendsSharedStyles, ...localStyles };
