import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing } from "../../../constants/theme";
import { friendsSharedStyles } from "./friendsShared.styles";

const separator = "rgba(255,255,255,0.12)";

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
  declineText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 17,
    lineHeight: 22,
  },
  challengeRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  emptyWrap: { marginBottom: spacing.xl },
  inviteCopy: { flex: 1, minWidth: 0, gap: 2 },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 64,
  },
  listCard: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  quietLink: {
    position: "relative",
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  quietLinkText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 17,
    lineHeight: 22,
  },
  rowMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 16,
  },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  rowScore: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 17,
    lineHeight: 22,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 17,
    lineHeight: 22,
  },
  separator: {
    position: "absolute",
    top: 0,
    left: spacing.md,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: separator,
  },
  stack: { gap: spacing.lg, marginBottom: spacing.xl },
});

export const friendsTogetherStyles = { ...friendsSharedStyles, ...localStyles };
