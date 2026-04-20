import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography, ui } from "../../constants/theme";
import { pressFeedbackStyle } from "./pressFeedback";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string | null;
  actionLabel?: string;
  onActionPress?: () => void;
  actionNode?: ReactNode;
};

export function ScreenHeader({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  actionNode,
}: ScreenHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionNode ? actionNode : null}
      {!actionNode && actionLabel && onActionPress ? (
        <Pressable
          style={({ pressed }) => [styles.action, pressFeedbackStyle(pressed, "light")]}
          onPress={onActionPress}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: ui.stackGap,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  textWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.screenTitle,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  action: {
    minHeight: 36,
    justifyContent: "center",
    borderRadius: ui.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  actionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
});
