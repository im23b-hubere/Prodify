import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { colors } from "../../constants/theme";

const HEIGHT = 52;
const BAR_STEP = 6;
const BAR_WIDTH = 3;
/** Recording speed: how long one bar takes to scroll one step. */
const MS_PER_BAR = 110;
/** Bar height left when paused: a flat line, like audio that stopped. */
const PAUSED_LEVEL = 0.06;

/** Fixed pseudo-random loudness per bar, so the clip looks like real audio, not a sine. */
function barHeights(count: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const swell = 0.55 + 0.45 * Math.sin(index * 0.21) * Math.cos(index * 0.057 + 1);
    const grain = Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
    return Math.max(4, HEIGHT * (0.18 + 0.82 * Math.abs(swell) * (0.45 + 0.55 * grain)));
  });
}

function clipPath(heights: number[]): string {
  return heights
    .map((height, index) => {
      const x = BAR_WIDTH / 2 + index * BAR_STEP;
      const top = (HEIGHT - height) / 2 + BAR_WIDTH / 2;
      return `M ${x} ${top} L ${x} ${top + height - BAR_WIDTH}`;
    })
    .join(" ");
}

/**
 * The session as a clip being recorded: audio keeps arriving under a red record head and
 * scrolls off into the past. It never fills up, because a session has no target length.
 * Paused, the tape coasts to a stop and the bars collapse into a flat line; resuming springs
 * them back up.
 */
export function LiveWaveform({
  paused,
  background,
}: {
  paused: boolean;
  /** The surface behind the clip: older audio fades out into it. */
  background: string;
}) {
  const [width, setWidth] = useState(0);
  const bars = Math.ceil(width / BAR_STEP) + 1;
  // Two identical copies side by side: scrolling one full copy loops seamlessly.
  const path = useMemo(() => (bars > 1 ? clipPath(barHeights(bars)) : ""), [bars]);
  const loopWidth = bars * BAR_STEP;

  const tape = useSharedValue(0);
  const head = useSharedValue(1);
  const enter = useSharedValue(0);
  const level = useSharedValue(paused ? PAUSED_LEVEL : 1);

  useEffect(() => {
    enter.set(withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [enter]);

  useEffect(() => {
    if (loopWidth <= 0) return;
    if (paused) {
      // Coast a few pixels instead of halting dead, while the bars fold down.
      const coastTo = Math.max(-loopWidth, tape.get() - BAR_STEP * 2);
      tape.set(withTiming(coastTo, { duration: 450, easing: Easing.out(Easing.cubic) }));
      level.set(withTiming(PAUSED_LEVEL, { duration: 520, easing: Easing.inOut(Easing.cubic) }));
      cancelAnimation(head);
      head.set(withTiming(0.35, { duration: 250 }));
      return;
    }
    level.set(withSpring(1, { damping: 11, stiffness: 160, mass: 0.7 }));
    head.set(withTiming(1, { duration: 250 }));
    const remaining = loopWidth + tape.get();
    // Finish the current lap from wherever the tape stopped, then loop forever.
    tape.set(
      withSequence(
        withTiming(-loopWidth, {
          duration: (remaining / BAR_STEP) * MS_PER_BAR,
          easing: Easing.linear,
        }),
        withRepeat(
          withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(-loopWidth, {
              duration: (loopWidth / BAR_STEP) * MS_PER_BAR,
              easing: Easing.linear,
            }),
          ),
          -1,
        ),
      ),
    );
  }, [head, level, loopWidth, paused, tape]);

  const tapeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tape.get() }],
  }));
  const headStyle = useAnimatedStyle(() => ({ opacity: head.get() }));
  const clipStyle = useAnimatedStyle(() => {
    const live = Math.max(0, Math.min(1, (level.get() - PAUSED_LEVEL) / (1 - PAUSED_LEVEL)));
    return {
      opacity: (0.4 + 0.6 * live) * enter.get(),
      transform: [{ scaleY: (0.2 + 0.8 * enter.get()) * level.get() }],
    };
  });

  return (
    <View
      style={styles.frame}
      onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      pointerEvents="none"
    >
      {path ? (
        <Animated.View style={[styles.clip, clipStyle]}>
          <Animated.View style={[styles.tape, { width: loopWidth * 2 }, tapeStyle]}>
            {[0, 1].map((copy) => (
              <Svg key={copy} width={loopWidth} height={HEIGHT}>
                <Path
                  d={path}
                  stroke={colors.primary}
                  strokeWidth={BAR_WIDTH}
                  strokeLinecap="round"
                />
              </Svg>
            ))}
          </Animated.View>
        </Animated.View>
      ) : null}
      {/* The past fades out to the left; fresh audio arrives at the record head. */}
      <LinearGradient
        colors={[background, `${background}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fadeLeft}
      />
      <Animated.View style={[styles.head, headStyle]}>
        <View style={styles.headDot} />
        <View style={styles.headLine} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "stretch",
    height: HEIGHT + 14,
    justifyContent: "center",
    overflow: "hidden",
  },
  clip: { height: HEIGHT, overflow: "hidden", marginRight: 10 },
  tape: { flexDirection: "row", height: HEIGHT },
  fadeLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: 72 },
  head: {
    position: "absolute",
    right: 8,
    top: 0,
    bottom: 0,
    width: 8,
    alignItems: "center",
  },
  headDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  headLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: colors.danger },
});
