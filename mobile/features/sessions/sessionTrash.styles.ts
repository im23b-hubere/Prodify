import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, motion, radii, spacing, typography, ui } from "../../constants/theme";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: ui.screenPadding,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  topBar: { paddingTop: spacing.xs, marginBottom: ui.stackGap },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accent: {
    width: 3,
    height: 28,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
    flexShrink: 1,
  },
  rowMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  restoreLabel: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  loadMoreLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  pressed: { opacity: motion.pressOpacity },
  disabled: { opacity: 0.5 },
  footerSpacer: { height: spacing.lg },
});
