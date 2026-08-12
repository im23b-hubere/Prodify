import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography, ui } from "../../constants/theme";

export const yourWeekStyles = StyleSheet.create({
  card: { gap: spacing.sm },
  cardHero: { gap: spacing.xs },
  embeddedShell: {
    gap: spacing.sm,
  },
  sectionEyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionEyebrowEmbedded: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  setupWrap: { gap: spacing.sm },
  setupTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.cardTitle,
  },
  setupTitleHero: {
    ...typography.body,
    fontFamily: fontFamily.bodyBold,
  },
  setupHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 72,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 2,
  },
  chipHero: {
    minHeight: 52,
  },
  chipEmbedded: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  chipPressed: { opacity: 0.88 },
  chipValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 24,
  },
  chipValueSelected: { color: colors.primary },
  chipLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 12,
  },
  chipLabelSelected: { color: colors.textPrimary },
  customLink: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    textDecorationLine: "underline",
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  bigNumber: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 32,
    lineHeight: 38,
  },
  bigNumberHero: {
    fontSize: 28,
    lineHeight: 32,
  },
  bigNumberDim: {
    color: colors.textSecondary,
    fontSize: 22,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    flex: 1,
    textAlign: "right",
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusOnTrack: {
    borderColor: "rgba(34,197,94,0.45)",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  statusBehind: {
    borderColor: "rgba(251,191,36,0.45)",
    backgroundColor: "rgba(251,191,36,0.1)",
  },
  statusDone: {
    borderColor: "rgba(255,61,0,0.45)",
    backgroundColor: "rgba(255,61,0,0.14)",
  },
  statusText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.round,
  },
  forecastLine: {
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  forecastOnTrack: { color: colors.success },
  forecastAtRisk: { color: colors.primary },
  forecastOffTrack: { color: colors.danger },
  nextStep: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    lineHeight: 18,
  },
  studioLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayCell: { alignItems: "center", gap: 4, flex: 1 },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  dayDotActive: {
    backgroundColor: "rgba(255,106,61,0.35)",
    borderColor: "rgba(255,106,61,0.55)",
  },
  dayDotToday: {
    borderColor: colors.primary,
  },
  dayLetter: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 11,
  },
  dayLetterActive: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  promiseRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  promiseText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  editLink: { alignItems: "center", paddingVertical: spacing.xs },
  editLinkText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    textDecorationLine: "underline",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.sectionTitle,
  },
  modalHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  input: {
    minHeight: ui.buttonHeight,
    borderRadius: ui.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    backgroundColor: colors.background,
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  shareLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    ...typography.body,
    flex: 1,
  },
  modalCancel: { alignItems: "center", paddingVertical: spacing.sm },
  modalCancelText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
  },
});
