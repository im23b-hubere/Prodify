import { StyleSheet } from "react-native";

import { LIST_HAIRLINE, listStyles } from "../../../components/ui/list/listStyles";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing } from "../../../constants/theme";

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
  actionPressed: { opacity: 0.55 },
  inviteCopy: { flex: 1, minWidth: 0, gap: 2 },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: LIST_HAIRLINE,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 64,
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
});

export const friendsTogetherStyles = { ...listStyles, ...localStyles };
