import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { LiveWaveform } from "../../../components/session/LiveWaveform";
import { HoldToStopButton, PauseButton } from "../../../components/session/SessionTransport";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { formatDurationWords } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";
import { formatTimer, notesPreview } from "../utils";

/** How far the transport keys rise when the deck appears. */
const KEY_RISE = 28;

type ActiveSessionBlockProps = {
  active: SessionDto;
  activeSeconds: number;
  isPaused: boolean;
  onOpenFullscreen: () => void;
  onStopNow: () => void;
  onPause: () => void;
  onResume: () => void;
  stopBusy: boolean;
  pauseBusy: boolean;
  resumeBusy: boolean;
};

/**
 * The running session as a recording: the clock, a clip that keeps growing under a record
 * head (no target length, so nothing fills up), and round pause / hold-to-stop keys that
 * rise in once the clip is rolling.
 */
export function ActiveSessionBlock({
  active,
  activeSeconds,
  isPaused,
  onOpenFullscreen,
  onStopNow,
  onPause,
  onResume,
  stopBusy,
  pauseBusy,
  resumeBusy,
}: ActiveSessionBlockProps) {
  const { t } = useTranslation();
  const preview = notesPreview(active.notes);

  return (
    <View style={[styles.card, !isPaused && styles.cardLive]}>
      <StageLight live={!isPaused} />
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("dashboard.focusModeA11y")}
        onPress={onOpenFullscreen}
        style={styles.recording}
      >
        <Text style={[styles.timer, isPaused && styles.timerPaused]}>
          {formatTimer(activeSeconds)}
        </Text>
        <Text style={styles.elapsedNatural} numberOfLines={1}>
          {formatDurationWords(activeSeconds, t)}
        </Text>
        <LiveWaveform paused={isPaused} background={colors.surface} />
      </Pressable>

      <View style={styles.deck}>
        <RiseIn delay={350}>
          <PauseButton
            paused={isPaused}
            disabled={isPaused ? resumeBusy : pauseBusy}
            label={isPaused ? t("sessionActive.resume") : t("sessionActive.pause")}
            onPress={isPaused ? onResume : onPause}
            testID={isPaused ? "dashboard-resume-session" : "dashboard-pause-session"}
          />
        </RiseIn>
        <RiseIn delay={450}>
          <HoldToStopButton
            disabled={stopBusy}
            label={stopBusy ? t("dashboard.stopping") : t("sessionActive.holdToEnd")}
            accessibilityHint={t("sessionActive.holdToEndA11y")}
            onHoldComplete={onStopNow}
            testID="dashboard-stop-session"
          />
        </RiseIn>
      </View>

      {preview ? (
        <Text style={styles.notesPreview} numberOfLines={1}>
          {preview}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A warm light rising from the foot of the card while recording, like a lit stage. It fades
 * out when the session is paused. It stays below the clip, so the clip's fade still matches.
 */
function StageLight({ live }: { live: boolean }) {
  const on = useSharedValue(live ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(live ? 1 : 0, { duration: 500 }));
  }, [live, on]);
  const style = useAnimatedStyle(() => ({ opacity: on.get() }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LinearGradient
        colors={["rgba(255,61,0,0)", "rgba(255,61,0,0)", "rgba(255,61,0,0.16)"]}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/** Springs a key up into place, a beat after the clip starts rolling. */
function RiseIn({ delay, children }: { delay: number; children: ReactNode }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(delay, withSpring(1, { damping: 13, stiffness: 150, mass: 0.7 })));
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.get() * 1.5),
    transform: [
      { translateY: (1 - progress.get()) * KEY_RISE },
      { scale: 0.5 + 0.5 * progress.get() },
    ],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cardLive: { borderColor: "rgba(255,61,0,0.32)" },
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
  recording: { alignSelf: "stretch", alignItems: "center" },
  deck: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxl,
  },
  timer: {
    fontSize: 48,
    lineHeight: 54,
    fontFamily: fontFamily.heading,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  timerPaused: { color: colors.textSecondary },
  elapsedNatural: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
    fontSize: 12,
    textAlign: "center",
  },
  notesPreview: {
    color: colors.textSecondary,
    ...typography.meta,
    textAlign: "center",
  },
});
