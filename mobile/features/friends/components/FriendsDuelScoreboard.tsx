import type { TFunction } from "i18next";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

type Props = {
  t: TFunction;
  leftLabel: string;
  leftScore: number;
  rightLabel: string;
  rightScore: number;
  meta?: string | null;
  actionLabel?: string | null;
  onAction?: () => void;
  testID?: string;
};

export const FriendsDuelScoreboard = memo(function FriendsDuelScoreboard({
  t,
  leftLabel,
  leftScore,
  rightLabel,
  rightScore,
  meta,
  actionLabel,
  onAction,
  testID,
}: Props) {
  const behind = rightScore - leftScore;
  const caption = [
    behind > 0 ? t("friendsScreen.leaderGapBehind", { count: behind, name: rightLabel }) : null,
    meta,
  ]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <View style={styles.shell} testID={testID}>
      <View style={[styles.scoreRow, !caption && styles.scoreRowAlone]}>
        <View style={styles.side}>
          <Text style={styles.sideLabel} numberOfLines={1}>
            {leftLabel}
          </Text>
          <Text style={styles.score}>{leftScore}</Text>
        </View>
        <View style={styles.side}>
          <Text style={[styles.sideLabel, styles.alignEnd]} numberOfLines={1}>
            {rightLabel}
          </Text>
          <Text style={[styles.score, styles.alignEnd]}>{rightScore}</Text>
        </View>
      </View>
      {caption ? (
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [styles.action, pressed && styles.rowPressed]}
          onPress={onAction}
        >
          <View style={styles.separator} />
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  scoreRowAlone: { paddingBottom: spacing.lg },
  side: { flex: 1, gap: 4 },
  sideLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  alignEnd: { textAlign: "right" },
  score: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
  },
  caption: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  action: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: {
    position: "absolute",
    top: 0,
    left: spacing.lg,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  actionText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 17,
    lineHeight: 22,
  },
});
