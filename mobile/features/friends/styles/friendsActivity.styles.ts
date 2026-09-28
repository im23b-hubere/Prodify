import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, spacing, typography } from "../../../constants/theme";
import { friendsSharedStyles } from "./friendsShared.styles";

const localStyles = StyleSheet.create({
  feedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2b2140",
    alignItems: "center",
    justifyContent: "center",
  },
  feedAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  feedAvatarText: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, fontSize: 14 },
  feedCopy: { flex: 1, minWidth: 0, gap: 1 },
  feedEventAction: {
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  feedEventActionText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  feedIconButton: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  feedIconCount: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  },
  feedIconCountActive: { color: colors.primary },
  feedMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 6,
  },
  feedSessionMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 16,
  },
  feedUserName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    lineHeight: 18,
  },
});

export const friendsActivityStyles = { ...friendsSharedStyles, ...localStyles };
