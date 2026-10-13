import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

export const reportSheetStyles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: radii.round,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.sectionTitle,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  centeredText: {
    textAlign: "center",
  },
  reasonList: {
    borderRadius: radii.md,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reasonRowSelected: {
    backgroundColor: "rgba(255,61,0,0.08)",
  },
  reasonCopy: {
    flex: 1,
    gap: 2,
  },
  reasonLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  reasonHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.round,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  note: {
    minHeight: 96,
    maxHeight: 160,
    borderRadius: radii.md,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    padding: spacing.md,
    textAlignVertical: "top",
    ...typography.body,
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  secondaryAction: {
    alignSelf: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryActionText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
  },
  doneContent: {
    alignItems: "center",
    paddingTop: spacing.xxl,
  },
  doneActions: {
    alignSelf: "stretch",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  blockAction: {
    minHeight: 52,
    borderRadius: radii.md,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  blockActionText: {
    color: colors.danger,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  pressed: {
    opacity: 0.7,
  },
});
