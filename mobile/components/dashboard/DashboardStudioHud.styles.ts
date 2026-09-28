import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

/** Height of a stat's value slot; the rank medallion on the dashboard is drawn at this size. */
export const METRIC_VALUE_HEIGHT = 32;

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
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  panelDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
  metricItemPressed: {
    opacity: 0.7,
  },
  metricHero: {
    height: METRIC_VALUE_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  metricValueRow: {
    // Shared height so numbers and the rank medallion sit on one centre line.
    height: METRIC_VALUE_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
    // Syne defaults to old-style figures, which drop some digits below the baseline.
    fontVariant: ["lining-nums"],
  },
  metricValueAccent: {
    color: colors.primary,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 2,
  },
  weekStripHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  weekStripTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
    flex: 1,
  },
  weekStripHistory: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  weekStripDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: spacing.sm,
  },
  weekStripDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  weekStripDotActive: {
    backgroundColor: colors.textPrimary,
  },
  weekDots: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayColumn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  dayLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  dayLabelToday: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  dayColumnFuture: {
    opacity: 0.45,
  },
  dayMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  dayMarkerSession: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayMarkerFreeze: {
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dayMarkerToday: {
    borderColor: colors.primary,
    borderStyle: "dashed",
  },
  dayTodayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
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
