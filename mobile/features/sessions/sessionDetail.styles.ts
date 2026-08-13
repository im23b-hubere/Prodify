import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export const sessionDetailStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  keyboardWrap: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  insightsWarning: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,170,0,0.35)",
    backgroundColor: "rgba(255,170,0,0.08)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  insightsWarningText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    lineHeight: 18,
  },
  insightsWarningAction: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.sm },
  backChevron: { color: colors.primary, fontSize: 28, lineHeight: 32 },
  backText: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.body },
  mutedNote: { color: colors.textSecondary, ...typography.caption },
  section: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.danger, fontFamily: fontFamily.body, ...typography.caption },
});
