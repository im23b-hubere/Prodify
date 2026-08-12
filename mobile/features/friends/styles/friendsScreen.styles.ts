import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

export const friendsScreenStyles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  safe: { flex: 1, backgroundColor: colors.background },
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
