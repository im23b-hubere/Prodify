import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography, ui } from "../../constants/theme";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: ui.screenPadding, paddingBottom: spacing.xxl, gap: spacing.md },
  heroCard: { borderWidth: 1 },
  levelTitle: { color: colors.textPrimary, ...typography.cardTitle },
  tierSections: { marginTop: spacing.sm, gap: spacing.lg },
  tierSection: { gap: spacing.sm },
  tierHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierHeaderText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tierLine: { flex: 1, height: 1 },
  metaLine: { color: colors.textSecondary, ...typography.meta, marginTop: spacing.xs },
  track: {
    marginTop: spacing.sm,
    width: "100%",
    height: 10,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.primary },
  hint: { marginTop: spacing.sm, color: colors.textSecondary, ...typography.caption },
  decayHint: { marginTop: spacing.xs, color: colors.textSecondary, ...typography.caption },
  levelRows: { gap: spacing.xs },
});
