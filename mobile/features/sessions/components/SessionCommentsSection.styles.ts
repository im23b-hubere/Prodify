import { StyleSheet } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, spacing, typography } from "../../../constants/theme";

export const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 17,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  sectionCount: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
  },
  mutedNote: { color: colors.textSecondary, ...typography.caption },
  errorText: { color: colors.danger, fontFamily: fontFamily.body, ...typography.caption },
  commentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginHorizontal: -spacing.xs,
  },
  commentAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  commentAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarInitials: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
  },
  commentContent: { flex: 1, gap: 2 },
  commentHeader: {
    ...typography.meta,
  },
  commentAuthor: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  commentTime: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
  },
  commentBody: {
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 21,
  },
});
