import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

export const LIST_HAIRLINE = "rgba(255,255,255,0.08)";
const PRESSED = "rgba(255,255,255,0.05)";

/** Section, card and row styles shared by every grouped list (duel board, friends overview). */
export const listStyles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 32 },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  sectionCount: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  sectionRight: { marginLeft: "auto" },

  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: LIST_HAIRLINE,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowPressed: { backgroundColor: PRESSED },
  rowDivider: {
    position: "absolute",
    top: 0,
    left: 72,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 21,
  },
  rowMeta: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.meta },

  textAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs },
  textActionLabel: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  textActionMuted: { color: colors.textSecondary },
  textActionPressed: { opacity: 0.6 },
});
