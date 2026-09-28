import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export const styles = StyleSheet.create({
  wrap: { width: "100%", gap: spacing.sm },
  setupTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
  },
  setupHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerPressed: { opacity: 0.82 },
  titleBlock: { flex: 1, gap: 2 },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 17,
    lineHeight: 22,
  },
  remainingText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  remainingDone: {
    color: colors.success,
    fontFamily: fontFamily.bodyBold,
  },
  ring: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: {
    position: "absolute",
    // Start the arc at 12 o'clock.
    transform: [{ rotate: "-90deg" }],
  },
  ringCount: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
    // Syne defaults to old-style figures, which drop some digits below the baseline.
    fontVariant: ["lining-nums"],
  },
  ringTarget: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
  },
  chipRow: { flexDirection: "row", gap: spacing.sm },
  chip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.14)",
  },
  chipPressed: { opacity: 0.88 },
  chipDisabled: { opacity: 0.6 },
  chipText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  chipTextActive: { color: colors.primary },
});
