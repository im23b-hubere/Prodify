import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export const paywallStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  badge: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
    fontSize: 22,
    lineHeight: 28,
  },
  body: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
  },
  restore: { alignItems: "center", paddingVertical: 2 },
  restoreText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  footer: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  disclaimer: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  legalLink: {
    color: colors.primary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  legalSep: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  accountActionText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
  },
  accountActionDestructive: {
    color: colors.danger,
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
  },
  skipDev: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  skipDevText: {
    color: colors.primary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
});
