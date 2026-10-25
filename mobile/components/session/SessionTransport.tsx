import * as Haptics from "expo-haptics";
import { Pause, Play, Square } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { fontFamily } from "../../constants/fonts";
import { colors, typography } from "../../constants/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const TRANSPORT_SIZE = 62;
const RING_SIZE = TRANSPORT_SIZE + 14;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
/** How long the stop button has to be held to end the session. */
export const HOLD_TO_STOP_MS = 900;

type PauseProps = {
  paused: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
};

/** Round pause / resume, like a deck's transport key. Resume turns it into the hot button. */
export function PauseButton({ paused, disabled, label, onPress, testID }: PauseProps) {
  return (
    <View style={styles.slot}>
      {/* Same box as the stop key's ring, so both captions sit on one line. */}
      <View style={styles.ringBox}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          disabled={disabled}
          testID={testID}
          style={({ pressed }) => [
            styles.key,
            paused ? styles.resumeKey : styles.pauseKey,
            pressed && styles.keyPressed,
          ]}
        >
          {paused ? (
            <Play size={22} color={colors.textPrimary} fill={colors.textPrimary} />
          ) : (
            <Pause size={22} color={colors.textPrimary} fill={colors.textPrimary} />
          )}
        </Pressable>
      </View>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

type StopProps = {
  disabled?: boolean;
  label: string;
  accessibilityHint: string;
  /** Held all the way round: end right away. The hold is the confirmation. */
  onHoldComplete: () => void;
  testID?: string;
};

/**
 * Round stop key you hold to end: a red ring fills around it while pressed, and letting go
 * early winds it back. Holding is the confirmation, so there's no dialog; a quick tap only
 * shakes the key and flashes its caption to show it wants holding.
 */
export function HoldToStopButton({
  disabled,
  label,
  accessibilityHint,
  onHoldComplete,
  testID,
}: StopProps) {
  const hold = useSharedValue(0);
  const shake = useSharedValue(0);
  const hint = useSharedValue(0);
  const completed = useRef(false);

  const nudge = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    shake.set(
      withSequence(
        withTiming(-7, { duration: 50 }),
        withTiming(7, { duration: 70 }),
        withTiming(-5, { duration: 60 }),
        withTiming(4, { duration: 60 }),
        withTiming(0, { duration: 50 }),
      ),
    );
    hint.set(withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 900 })));
  };

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - hold.get()),
    strokeOpacity: hold.get() > 0.01 ? 1 : 0,
  }));
  const keyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.08 * hold.get() }],
  }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  const captionStyle = useAnimatedStyle(() => ({
    color: interpolateColor(hint.get(), [0, 1], [colors.textSecondary, colors.danger]),
  }));

  return (
    <View style={styles.slot}>
      <Animated.View style={[styles.ringBox, shakeStyle]}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="rgba(255,68,68,0.16)"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.danger}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={[RING_LENGTH, RING_LENGTH]}
            fill="none"
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            animatedProps={ringProps}
          />
        </Svg>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          disabled={disabled}
          testID={testID}
          delayLongPress={HOLD_TO_STOP_MS}
          onPressIn={() => {
            completed.current = false;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            hold.set(withTiming(1, { duration: HOLD_TO_STOP_MS, easing: Easing.linear }));
          }}
          onPressOut={() => {
            if (!completed.current) hold.set(withTiming(0, { duration: 220 }));
          }}
          onLongPress={() => {
            completed.current = true;
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
            onHoldComplete();
          }}
          onPress={nudge}
        >
          <Animated.View style={[styles.key, styles.stopKey, keyStyle]}>
            <Square size={18} color={colors.danger} fill={colors.danger} />
          </Animated.View>
        </Pressable>
      </Animated.View>
      <Animated.Text style={[styles.caption, captionStyle]}>{label}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: "center", gap: 6, width: RING_SIZE },
  ringBox: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  key: {
    width: TRANSPORT_SIZE,
    height: TRANSPORT_SIZE,
    borderRadius: TRANSPORT_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  pauseKey: { backgroundColor: colors.surface, borderColor: colors.border },
  resumeKey: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  stopKey: { backgroundColor: "rgba(255,68,68,0.12)", borderColor: "rgba(255,68,68,0.45)" },
  keyPressed: { transform: [{ scale: 0.94 }], opacity: 0.85 },
  caption: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
    fontSize: 11,
    textAlign: "center",
  },
});
