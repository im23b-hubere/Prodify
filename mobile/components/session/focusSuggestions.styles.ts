import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, motion, radii, spacing, typography } from "../../constants/theme";

export const focusSuggestionStyles = StyleSheet.create({
  section: { marginTop: spacing.sm, gap: spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    experimental_backgroundImage:
      "linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  pillPressed: {
    opacity: motion.pressOpacity,
    transform: [{ scale: motion.pressScaleStrong }],
  },
  pillDisabled: { opacity: 0.4 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
  name: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  reason: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
});
