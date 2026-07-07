import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, shadows, spacing, typography } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import type { SessionDto } from "../../../types/session";
import { formatNaturalCounting, formatTimer, notesPreview } from "../utils";

type ActiveSessionBlockProps = {
  active: SessionDto;
  activeSeconds: number;
  ringPulse: SharedValue<number>;
  onOpenFullscreen: () => void;
  onConfirmStop: () => void;
  stopBusy: boolean;
};

export function ActiveSessionBlock({
  active,
  activeSeconds,
  ringPulse,
  onOpenFullscreen,
  onConfirmStop,
  stopBusy,
}: ActiveSessionBlockProps) {
  const { t } = useTranslation();
  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringPulse.value }],
    opacity: 0.45 + 0.35 * (ringPulse.value - 1),
  }));
  const preview = notesPreview(active.notes);

  return (
    <View style={styles.activeSessionBlock}>
      <View style={styles.badgeRow}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {sessionTypeLabel(String(active.session_type || "beat_making"), t)}
          </Text>
        </View>
      </View>

      <View style={styles.timerRingWrap}>
        <Animated.View style={[styles.pulseRingOuter, ringAnimatedStyle]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("dashboard.focusModeA11y")}
          onPress={onOpenFullscreen}
          style={styles.timerPressable}
        >
          <LinearGradient colors={["#2a1410", "#1a1a1a"]} style={styles.timerInner}>
            <Text style={styles.heroTimer}>{formatTimer(activeSeconds)}</Text>
            <Text style={styles.elapsedNatural}>{formatNaturalCounting(activeSeconds, t)}</Text>
            {preview ? (
              <Text style={styles.notesPreview} numberOfLines={2}>
                {preview}
              </Text>
            ) : null}
            <View style={styles.swipeHint}>
              <Text style={styles.swipeHintText}>{t("dashboard.swipeFocusHint")}</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.stopSessionBtn, pressed && styles.pressedStop]}
        onPress={onConfirmStop}
        disabled={stopBusy}
        testID="dashboard-stop-session"
      >
        <Text style={styles.stopSessionLabel}>
          {stopBusy ? t("dashboard.stopping") : t("dashboard.stopSession")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  activeSessionBlock: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  badgeRow: {
    alignItems: "center",
  },
  typeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,61,0,0.18)",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  typeBadgeText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    letterSpacing: 0.4,
  },
  timerRingWrap: {
    alignSelf: "center",
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  timerPressable: {
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRingOuter: {
    position: "absolute",
    width: 268,
    height: 268,
    borderRadius: 134,
    borderWidth: 3,
    borderColor: "rgba(255,68,68,0.9)",
    shadowColor: "#ff4444",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  timerInner: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  heroTimer: {
    fontSize: 52,
    lineHeight: 56,
    fontFamily: fontFamily.heading,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  elapsedNatural: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.body,
    textAlign: "center",
  },
  notesPreview: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
  },
  swipeHint: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    opacity: 0.9,
  },
  swipeHintText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontSize: 12,
    textAlign: "center",
  },
  stopSessionBtn: {
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,68,68,0.18)",
    borderWidth: 2,
    borderColor: colors.danger,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.button,
  },
  pressedStop: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  stopSessionLabel: {
    color: colors.danger,
    fontFamily: fontFamily.heading,
    fontSize: 18,
    letterSpacing: 0.8,
  },
});
