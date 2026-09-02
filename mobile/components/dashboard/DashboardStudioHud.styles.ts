import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography, ui } from "../../constants/theme";

export const styles = StyleSheet.create({
  stack: {
    width: "100%",
    gap: spacing.md,
  },
  sessionLoadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  sessionLoadingText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    textAlign: "center",
  },
  actionWrap: {
    width: "100%",
  },
  weekPanel: {
    borderRadius: ui.cardRadius,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.22)",
    overflow: "hidden",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingTop: spacing.xs,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 22,
    lineHeight: 26,
  },
  metricValueAccent: {
    color: colors.primary,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    textAlign: "center",
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  weekDots: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayColumn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  dayLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  dayLabelToday: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  weekBarTrack: {
    height: 22,
    width: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  weekBarTrackToday: {
    backgroundColor: "rgba(255,61,0,0.18)",
  },
  weekBarFill: {
    width: "100%",
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  weekBarSession: {
    backgroundColor: colors.primary,
  },
  weekBarFreeze: {
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  freezeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.35)",
    backgroundColor: "rgba(255,61,0,0.08)",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  freezeDisabled: {
    opacity: 0.55,
  },
  freezeLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
});
