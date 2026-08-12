import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  hero: { alignItems: "center", marginBottom: spacing.lg },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.background,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  title: {
    marginTop: spacing.md,
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    letterSpacing: -0.8,
    textAlign: "center",
    ...typography.headline,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    textAlign: "center",
    ...typography.body,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
    fontFamily: fontFamily.bodyMedium,
    marginBottom: 8,
  },
  input: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    fontFamily: fontFamily.body,
  },
  error: { color: colors.danger, marginBottom: 12, fontSize: 14 },
  connectionHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: "center",
  },
  linkWrap: { marginTop: 18, alignItems: "center" },
  link: { color: colors.textSecondary, fontFamily: fontFamily.bodyMedium, ...typography.caption },
});
