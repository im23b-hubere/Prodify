import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export const friendProfileStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  ambient: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  topRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  back: { alignSelf: "flex-start" },
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
  // An open heading over the page glow, like the visible profile, rather than a card.
  locked: {
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  lockedMainTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.screenTitle,
    textAlign: "center",
  },
  lockedSub: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
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
  commitmentCount: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.cardTitle,
  },
  commitmentTrack: {
    height: 6,
    borderRadius: radii.round,
    backgroundColor: colors.border,
    overflow: "hidden",
    marginVertical: spacing.xs,
  },
  commitmentFill: { height: "100%", borderRadius: radii.round, backgroundColor: colors.primary },
  commitmentFillDone: { backgroundColor: colors.success },
  commitmentStatus: { color: colors.textSecondary, ...typography.caption },
  commitmentStatusBehind: { color: colors.primary },
  commitmentStatusDone: { color: colors.success },
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
