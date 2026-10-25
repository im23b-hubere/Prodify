import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { colors } from "../../constants/theme";
import { getLaunchPhase, setLaunchPhase, useLaunchPhase } from "../../lib/launch";
import { ProdifyWordmark } from "./ProdifyWordmark";

/** Same size as `imageWidth` in the expo-splash-screen plugin, so the hand-off is seamless. */
const MARK_SIZE = 84;
/** Reveal anyway if no screen asks for it (an unexpected entry route). */
const SAFETY_REVEAL_MS = 5000;
/** A four-step sequencer: the playhead lights each step in turn. */
const STEPS = 4;
const STEP_MS = 160;
const STEP_LIT_MS = 110;
/** Each step fades over two steps' time, so a soft tail trails the playhead. */
const STEP_FADE_MS = STEP_MS * 2 - STEP_LIT_MS;
const CYCLE_MS = STEPS * STEP_MS;
/** The lift-off: the mark rises and fades while the dark layer dissolves. */
const LIFT_MS = 420;
const LIFT_PX = 28;
const DISSOLVE_DELAY_MS = 120;
const DISSOLVE_MS = 380;

/** One step of the sequencer: dark until the playhead reaches it, then a quick orange flash. */
function SequencerStep({ index }: { index: number }) {
  const lit = useSharedValue(0);

  useEffect(() => {
    lit.set(
      withDelay(
        index * STEP_MS,
        withRepeat(
          withSequence(
            withTiming(1, { duration: STEP_LIT_MS, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: STEP_FADE_MS, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: CYCLE_MS - STEP_LIT_MS - STEP_FADE_MS }),
          ),
          -1,
        ),
      ),
    );
  }, [index, lit]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: lit.get(),
    transform: [{ scale: 1 + lit.get() * 0.3 }],
  }));
  return (
    <View style={styles.step}>
      <Animated.View style={[styles.stepLit, glowStyle]} />
    </View>
  );
}

/** Four steps lit one after another, like a beat playing across a sequencer row. */
function SequencerDots() {
  return (
    <View style={styles.sequencer}>
      {Array.from({ length: STEPS }, (_, index) => (
        <SequencerStep key={index} index={index} />
      ))}
    </View>
  );
}

/**
 * Covers the app at launch with the native splash's mark (same place, same size), the
 * wordmark and a row of sequencer dots. When the start route has opened the first screen,
 * the mark lifts off and the dark layer dissolves to show it.
 */
export function LaunchOverlay() {
  const phase = useLaunchPhase();
  const reduceMotion = useReducedMotion();

  const caption = useSharedValue(0);
  const lift = useSharedValue(0);
  const cover = useSharedValue(1);

  useEffect(() => {
    caption.set(withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }));
    const safety = setTimeout(() => {
      if (getLaunchPhase() === "splash") setLaunchPhase("revealing");
    }, SAFETY_REVEAL_MS);
    return () => clearTimeout(safety);
  }, [caption]);

  useEffect(() => {
    if (phase !== "revealing") return;
    const finish = () => setLaunchPhase("done");
    const ease = Easing.out(Easing.cubic);

    if (reduceMotion) {
      cover.set(
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished) scheduleOnRN(finish);
        }),
      );
      return;
    }
    lift.set(withTiming(1, { duration: LIFT_MS, easing: ease }));
    cover.set(
      withDelay(
        DISSOLVE_DELAY_MS,
        withTiming(0, { duration: DISSOLVE_MS, easing: ease }, (finished) => {
          if (finished) scheduleOnRN(finish);
        }),
      ),
    );
  }, [phase, reduceMotion, lift, cover]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.get() }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: 1 - lift.get(),
    transform: [{ translateY: -LIFT_PX * lift.get() }],
  }));
  const captionStyle = useAnimatedStyle(() => ({
    opacity: caption.get() * (1 - lift.get()),
    transform: [{ translateY: -LIFT_PX * lift.get() + (1 - caption.get()) * 6 }],
  }));

  if (phase === "done") return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.cover, coverStyle]}
      // Taps reach the app as soon as it starts showing.
      pointerEvents={phase === "splash" ? "auto" : "none"}
      accessibilityElementsHidden={phase !== "splash"}
    >
      <View style={styles.center} pointerEvents="none">
        <Animated.Image
          source={require("../../assets/branding/logo-startup.png")}
          style={[styles.mark, markStyle]}
        />
        <Animated.View style={[styles.caption, captionStyle]}>
          <ProdifyWordmark style={styles.wordmark} />
          <SequencerDots />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    backgroundColor: colors.background,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  // The rounded corners are part of the image; a border radius here would clip them twice.
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  // Hangs below the centred mark without moving it off the native splash's position.
  caption: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    marginTop: MARK_SIZE / 2 + 14,
    alignItems: "center",
    gap: 14,
  },
  wordmark: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
  },
  sequencer: {
    height: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  step: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#2a2a2a",
  },
  stepLit: {
    ...StyleSheet.absoluteFill,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
});
