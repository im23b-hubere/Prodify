import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

export const friendsScreenStyles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  safe: { flex: 1, backgroundColor: colors.background },
  overview: { gap: spacing.xl },
  pressed: { opacity: 0.6 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.35)",
    backgroundColor: "rgba(255,80,80,0.08)",
  },
  errorBannerCopy: { flex: 1, minWidth: 0, gap: 2 },
  errorBannerTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  errorBannerMessage: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
  },
  errorBannerAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  errorBannerActionLabel: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  toast: {
    position: "absolute",
    bottom: 18,
    left: spacing.md,
    right: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(20,20,20,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  toastText: {
    color: colors.textPrimary,
    textAlign: "center",
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
});
