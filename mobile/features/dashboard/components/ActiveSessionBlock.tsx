import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { formatDurationWords } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";
import { formatNaturalCounting, formatTimer, notesPreview } from "../utils";

type ActiveSessionBlockProps = {
  active: SessionDto;
  activeSeconds: number;
  isPaused: boolean;
  ringPulse: SharedValue<number>;
  onOpenFullscreen: () => void;
  onConfirmStop: () => void;
  onResume: () => void;
  stopBusy: boolean;
  resumeBusy: boolean;
};

export function ActiveSessionBlock({
  active,
  activeSeconds,
  isPaused,
  ringPulse,
  onOpenFullscreen,
  onConfirmStop,
  onResume,
  stopBusy,
  resumeBusy,
}: ActiveSessionBlockProps) {
  const { t } = useTranslation();
  const ringAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + 0.28 * (ringPulse.value - 1),
  }));
  const preview = notesPreview(active.notes);

  return (
    <View style={styles.activeSessionBlock}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("dashboard.focusModeA11y")}
        onPress={onOpenFullscreen}
        style={styles.timerPressable}
      >
        {isPaused ? null : <Animated.View style={[styles.pulse, ringAnimatedStyle]} />}
        <View style={styles.liveRow}>
          {isPaused ? null : <View style={styles.liveDot} />}
          <Text style={isPaused ? styles.pausedLabel : styles.liveLabel}>
            {isPaused ? t("dashboard.pausedLabel") : t("dashboard.liveLabel")}
          </Text>
          <Text style={styles.liveSep}>·</Text>
          <Text style={styles.typeLabel}>
            {sessionTypeLabel(String(active.session_type || "beat_making"), t)}
          </Text>
        </View>
        <Text style={styles.heroTimer}>{formatTimer(activeSeconds)}</Text>
        <Text style={styles.elapsedNatural}>
          {isPaused
            ? formatDurationWords(activeSeconds, t)
            : formatNaturalCounting(activeSeconds, t)}
        </Text>
        {preview ? (
          <Text style={styles.notesPreview} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.sessionActions}>
        {isPaused ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("sessionActive.resume")}
            style={({ pressed }) => [
              styles.stopSessionBtn,
              styles.actionButton,
              pressed && styles.pressedStop,
            ]}
            onPress={onResume}
            disabled={resumeBusy}
            testID="dashboard-resume-session"
          >
            <Text style={styles.stopSessionLabel}>{t("sessionActive.resume")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.stopSessionBtn,
            styles.actionButton,
            pressed && styles.pressedStop,
          ]}
          onPress={onConfirmStop}
          disabled={stopBusy}
          testID="dashboard-stop-session"
        >
          <Text style={styles.stopSessionLabel}>
            {stopBusy ? t("dashboard.stopping") : t("dashboard.stopSession")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  activeSessionBlock: {
    gap: spacing.md,
  },
  timerPressable: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,61,0,0.28)",
    backgroundColor: "#1a1210",
    overflow: "hidden",
    gap: spacing.xs,
  },
  pulse: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  sessionActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  pausedLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  liveLabel: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  liveSep: {
    color: colors.textSecondary,
  },
  typeLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.meta,
  },
  heroTimer: {
    fontSize: 48,
    lineHeight: 54,
    fontFamily: fontFamily.heading,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  elapsedNatural: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
    textAlign: "center",
  },
  notesPreview: {
    color: colors.textSecondary,
    ...typography.meta,
    textAlign: "center",
  },
  stopSessionBtn: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  pressedStop: {
    opacity: 0.85,
  },
  stopSessionLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
});
