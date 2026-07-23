import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  testID?: string;
  stepIndex: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function OnboardingQuizShell({
  testID,
  stepIndex,
  totalSteps,
  title,
  subtitle,
  onBack,
  onSkip,
  skipLabel,
  children,
  footer,
}: Props) {
  const progress = Math.max(0, Math.min(1, (stepIndex + 1) / totalSteps));

  return (
    <SafeAreaView testID={testID} style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.iconBtn}
            onPress={onBack}
          >
            <ChevronLeft color={colors.textPrimary} size={22} />
          </Pressable>
        ) : (
          <View style={styles.iconSpacer} />
        )}
        <Text style={styles.stepLabel}>
          {stepIndex + 1} / {totalSteps}
        </Text>
        {onSkip ? (
          <Pressable accessibilityRole="button" onPress={onSkip} hitSlop={12}>
            <Text style={styles.skip}>{skipLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <Animated.View entering={FadeInDown.duration(280).springify()} style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.content}>{children}</View>
      </Animated.View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconSpacer: { width: 40 },
  stepLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    letterSpacing: 0.4,
  },
  skip: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  progressTrack: {
    height: 4,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.body,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  content: {
    flex: 1,
    gap: spacing.sm,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
