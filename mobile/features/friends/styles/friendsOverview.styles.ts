import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { friendsSharedStyles } from "./friendsShared.styles";

const localStyles = StyleSheet.create({
  activityList: { gap: 0 },
  triggerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,61,0,0.1)",
  },
  triggerRowTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  triggerRowAction: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});

export const friendsOverviewStyles = { ...friendsSharedStyles, ...localStyles };
