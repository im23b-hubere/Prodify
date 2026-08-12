import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../../constants/theme";

export const friendsSharedStyles = StyleSheet.create({
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#2b2140",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatarLabel: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
  cardElevated: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  rankNumberBronze: {
    color: "#cd7f32",
  },
  rankNumberGold: {
    color: "#fcd34d",
  },
  rankNumberSilver: {
    color: "#d1d5db",
  },
  rankNumberTop: {
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
  },
  sectionWrap: { marginBottom: spacing.xl },
  triggerActionPrimary: {
    alignSelf: "flex-start",
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.24)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  triggerActionTextPrimary: {
    color: colors.textPrimary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  userMeta: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
  userName: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  youPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.round,
    backgroundColor: "rgba(162,89,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.45)",
  },
  youPillText: { color: colors.secondary, fontFamily: fontFamily.bodyBold, fontSize: 10 },
});
