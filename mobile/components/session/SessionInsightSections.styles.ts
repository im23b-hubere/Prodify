import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  impactCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  impactCardSurface: { backgroundColor: "rgba(255,61,0,0.08)" },
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  impactLine: { color: colors.textPrimary, ...typography.body, marginBottom: 6 },
  focusCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  focusRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  ringSvg: { transform: [{ rotate: "0deg" }] },
  focusTextCol: { flex: 1, gap: 4 },
  focusBig: { fontSize: 36, fontFamily: fontFamily.heading, color: colors.textPrimary },
  focusSub: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  focusBench: { color: colors.textSecondary, ...typography.caption },
  tipsBlock: { marginTop: spacing.sm, gap: 4 },
  tipsTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  tipLine: { color: colors.textSecondary, ...typography.caption },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  rowLine: { color: colors.textPrimary, ...typography.body, marginBottom: 4 },
  timeline: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  timelineSeg: { height: "100%" },
  timelineActive: { backgroundColor: colors.primary },
  timelinePaused: { backgroundColor: "rgba(255,255,255,0.2)" },
  insightTxt: { color: colors.textSecondary, ...typography.caption, marginBottom: 6 },
  relRow: { gap: spacing.sm, paddingVertical: 4 },
  relCard: {
    width: 140,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  relType: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  relDur: { color: colors.textSecondary, ...typography.caption, marginTop: 4 },
});
