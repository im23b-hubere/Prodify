import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing } from "../../../constants/theme";
import { friendsSharedStyles } from "./friendsShared.styles";

const localStyles = StyleSheet.create({
  acceptBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 17,
    lineHeight: 22,
  },
  acceptPill: {
    minHeight: 36,
    minWidth: 76,
    paddingHorizontal: spacing.md,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptPillText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    lineHeight: 18,
  },
  actionPressed: { opacity: 0.55 },
  declineBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs },
  declineText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  duelInviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  duelInviteDivider: {
    position: "absolute",
    top: 0,
    left: 72,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  inviteCopy: { flex: 1, minWidth: 0, gap: 2 },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 64,
  },
  listCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  quietLink: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  quietLinkText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 21,
  },
  rowMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 16,
  },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  rowTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 21,
  },
});

export const friendsTogetherStyles = { ...friendsSharedStyles, ...localStyles };
