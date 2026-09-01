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
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.sm,
  },
  badge: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.4,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 340,
  },
  plans: {
    gap: spacing.sm,
  },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 76,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planSelected: {
    borderColor: "rgba(255,61,0,0.65)",
    backgroundColor: "rgba(255,61,0,0.08)",
  },
  planPressed: {
    borderColor: "rgba(255,255,255,0.16)",
  },
  planDisabled: {
    opacity: 0.5,
  },
  planCopy: {
    flex: 1,
    gap: 6,
  },
  planBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,61,0,0.16)",
  },
  planBadgeText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  planPeriod: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
  },
  planPrice: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
  },
  planPriceSelected: {
    color: colors.textPrimary,
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: radii.round,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  planRadioOn: {
    borderColor: colors.primary,
  },
  planRadioDot: {
    width: 10,
    height: 10,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  continueWrap: {
    marginTop: spacing.sm,
  },
  restore: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  restoreText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  disclaimer: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    opacity: 0.85,
  },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  legalLink: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  legalSep: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.5,
  },
  accountActionText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
  },
  skipDev: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  skipDevText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
  },
});
