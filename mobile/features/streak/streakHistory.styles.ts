import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../constants/theme";

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.cardTitle,
  },
  cardBody: { color: colors.textSecondary, ...typography.body },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardCurrent: {
    borderColor: "rgba(255,106,61,0.45)",
    backgroundColor: "rgba(255,106,61,0.06)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  days: { color: colors.textPrimary, fontFamily: fontFamily.heading, fontSize: 28 },
  currentBadge: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(255,106,61,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,106,61,0.35)",
  },
  currentBadgeText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  range: { color: colors.textSecondary, ...typography.body, marginTop: spacing.xs },
  footnote: {
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
