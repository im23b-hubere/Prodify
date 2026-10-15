import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

export const engagementDebugStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardChosen: {
    borderColor: colors.primary,
  },
  decisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  decisionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.cardTitle,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.round,
    borderWidth: 1,
  },
  pillSend: {
    borderColor: colors.success,
  },
  pillSkip: {
    borderColor: colors.border,
  },
  pillText: {
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  pillTextSend: {
    color: colors.success,
  },
  pillTextSkip: {
    color: colors.textSecondary,
  },
  body: {
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  muted: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  rowLabel: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  rowValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    fontVariant: ["tabular-nums"],
  },
  candidateHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  candidateType: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  candidateScore: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.cardTitle,
    fontVariant: ["tabular-nums"],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  skeletonBlock: {
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
});
