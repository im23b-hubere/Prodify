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
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerPressed: { opacity: 0.82 },
  titleBlock: { flex: 1, gap: 2 },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.body,
  },
  remainingText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  progressNumbers: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 25,
  },
  goalProgressTrack: {
    width: "100%",
    height: 8,
    borderRadius: radii.round,
    backgroundColor: "rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
  goalProgressFill: {
    height: "100%",
    borderRadius: radii.round,
    backgroundColor: colors.primary,
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
