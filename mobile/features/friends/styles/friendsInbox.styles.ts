import { StyleSheet } from "react-native";

import { listStyles } from "../../../components/ui/list/listStyles";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing } from "../../../constants/theme";

const inboxStyles = StyleSheet.create({
  inbox: { marginBottom: spacing.lg },
  inboxRow: { gap: spacing.sm, minHeight: 72 },
  declineBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs },
  declineText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  actionPressed: { opacity: 0.55 },
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
});

export const friendsInboxStyles = { ...listStyles, ...inboxStyles };
