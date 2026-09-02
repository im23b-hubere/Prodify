import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography } from "../../constants/theme";

export const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerTitleHit: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
    minHeight: 44,
  },
  nudgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  viewAll: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  leaderBlock: { gap: 2 },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  leaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rankTxt: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
    width: 18,
    textAlign: "center",
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
  },
  meta: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  feed: { gap: 2 },
  feedRow: {
    paddingVertical: spacing.sm,
  },
  feedName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
  },
  feedMeta: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
  },
  loading: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  signalTxt: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  primaryWrap: {
    gap: 4,
    paddingTop: spacing.xs,
  },
  primaryMsg: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  primaryHint: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  primaryBtn: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  primaryBtnTxt: {
    color: colors.primary,
    ...typography.meta,
    fontFamily: fontFamily.bodyBold,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  emptySub: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  emptyBtn: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  emptyBtnTxt: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
});
