import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, motion, radii, spacing, typography, ui } from "../../constants/theme";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: ui.screenPadding, paddingBottom: spacing.xxl },
  headerRow: { marginBottom: spacing.md, gap: spacing.sm },
  filterHint: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.body,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  filterRow: { flexDirection: "row", gap: spacing.sm },
  filterChip: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  filterChipActive: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.2)" },
  filterChipPressed: { opacity: motion.pressOpacity, transform: [{ scale: motion.pressScale }] },
  filterLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  filterLabelActive: { color: colors.textPrimary },
  contentFadeWrap: {
    gap: spacing.lg,
  },
  heroStatValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  heroWrap: {
    marginBottom: spacing.xs,
  },
  mergedHeroShell: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  mergedHeroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  hintCard: {
    gap: 4,
    paddingVertical: spacing.xs,
  },
  hintLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  hintText: { color: colors.textSecondary, ...typography.body, lineHeight: 22 },
});
