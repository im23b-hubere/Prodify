import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { friendsSharedStyles } from "./friendsShared.styles";

const localStyles = StyleSheet.create({
  acceptBtn: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.15)" },
  declineBtn: { borderColor: colors.border, backgroundColor: "transparent" },
  incomingActions: { flexDirection: "row", gap: spacing.xs },
  incomingCopy: { flex: 1 },
  incomingHint: { color: colors.textSecondary, ...typography.caption },
  incomingList: { gap: spacing.sm },
  incomingName: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  incomingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  smallBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  smallBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  smallBtnTextDim: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});

export const friendsIncomingStyles = { ...friendsSharedStyles, ...localStyles };
