import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, motion, radii, spacing, typography, ui } from "../../constants/theme";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: ui.screenPadding, paddingBottom: spacing.xxl, gap: spacing.sm },
  headerBlock: { gap: spacing.sm, marginBottom: spacing.md },
  headerLinks: { flexDirection: "row", justifyContent: "flex-end" },
  link: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.meta },
  linkPressed: { opacity: motion.pressOpacity },
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
  },
  deleteActionText: { color: "#fff", fontFamily: fontFamily.bodyBold, ...typography.meta },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadMoreText: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.meta },
  footerSpacer: { height: spacing.lg },
});
