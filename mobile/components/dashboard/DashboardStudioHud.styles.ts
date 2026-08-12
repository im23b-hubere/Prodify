import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.22)",
    overflow: "hidden",
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  actionWrap: {
    width: "100%",
  },
  startBtn: {
    width: "100%",
  },
  startBtnInner: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  startEmoji: {
    fontSize: 32,
    color: "#fff",
  },
  startTitle: {
    color: "#fff",
    fontFamily: fontFamily.heading,
    fontSize: 22,
    letterSpacing: 1,
  },
  customizeBtn: {
    alignItems: "center",
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  customizeText: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statusLine: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: spacing.sm,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.xs,
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
    gap: 4,
  },
  dayLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
  },
  dayLabelToday: {
    color: colors.textPrimary,
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayDotSession: {
    backgroundColor: colors.primary,
    borderColor: "rgba(255,61,0,0.6)",
  },
  dayDotFreeze: {
    backgroundColor: colors.secondary,
    borderColor: "rgba(162,89,255,0.6)",
  },
  dayDotToday: {
    transform: [{ scale: 1.15 }],
  },
  freezeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.35)",
    backgroundColor: "rgba(162,89,255,0.1)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  freezeDisabled: {
    opacity: 0.65,
  },
  freezeLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
