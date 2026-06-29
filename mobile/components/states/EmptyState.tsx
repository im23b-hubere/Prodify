import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography, ui } from "../../constants/theme";
import { AppCard } from "../ui/AppCard";
import { PrimaryButton } from "../ui/PrimaryButton";
import { TextButton } from "../ui/TextButton";

type EmptyStateProps = {
  /** Emoji fallback when `iconNode` is not set. */
  icon?: string;
  iconNode?: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Inline variant for use inside existing cards (no outer AppCard). */
  compact?: boolean;
};

export function EmptyState({
  icon,
  iconNode,
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
}: EmptyStateProps) {
  const content = (
    <>
      {iconNode ? <View style={styles.iconNodeWrap}>{iconNode}</View> : null}
      {!iconNode && icon ? <Text style={styles.iconEmoji}>{icon}</Text> : null}
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} />
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <TextButton label={secondaryActionLabel} onPress={onSecondaryAction} subdued />
      ) : null}
    </>
  );

  if (compact) {
    return <View style={styles.compactContainer}>{content}</View>;
  }

  return <AppCard style={styles.container}>{content}</AppCard>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: ui.compactGap,
  },
  compactContainer: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  iconNodeWrap: {
    marginBottom: spacing.xs,
  },
  iconEmoji: {
    fontSize: 26,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.cardTitle,
    textAlign: "center",
  },
  titleCompact: {
    ...typography.body,
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
    textAlign: "center",
  },
});
