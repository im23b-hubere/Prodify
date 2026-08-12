import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export const friendProfileStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  back: { color: colors.secondary, fontFamily: fontFamily.bodyBold, ...typography.body },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  bootWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bootBackBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  bootBackTxt: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  locked: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  lockedMainTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
    textAlign: "center",
  },
  lockedSub: { color: colors.textSecondary, ...typography.body },
  block: { marginBottom: spacing.sm },
  statsCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  cardTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  line: { color: colors.textPrimary, ...typography.body },
  lineMuted: { color: colors.textSecondary, ...typography.body },
  lineStrong: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  muted: { color: colors.textSecondary, ...typography.caption },
  ach: { color: colors.textPrimary, ...typography.body, flex: 1 },
  achRow: { marginBottom: spacing.xs },
  sessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sessRowPressed: { opacity: 0.85 },
  sessCol: { flex: 1, gap: 2, paddingRight: spacing.sm },
  sessType: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  sessDate: { color: colors.textSecondary, ...typography.caption },
  sessMeta: { color: colors.textSecondary, ...typography.caption },
});
