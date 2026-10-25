import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type AccessibilityActionEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import { fontFamily } from "../../../constants/fonts";
import { colors } from "../../../constants/theme";
import { experienceFromYears } from "../../../lib/onboardingQuiz";

/** The last stop reads "10+". */
const YEARS_MAX = 10;
const YEAR_WIDTH = 64;
const BARS_PER_YEAR = 8;
const BAR_STEP = YEAR_WIDTH / BARS_PER_YEAR;
const BAR_WIDTH = 3;
const WAVE_HEIGHT = 130;
/** The tallest bar, as a share of the wave area. */
const BAR_REACH = 0.88;
const RULER_HEIGHT = 34;
/** Space above the clip for the playhead's diamond cap. */
const PLAYHEAD_CAP_ROOM = 22;
const BAR_COUNT = YEARS_MAX * BARS_PER_YEAR + 1;
/** The clip's full width, with half a bar of room on each side for the round caps. */
const CLIP_WIDTH = YEARS_MAX * YEAR_WIDTH + BAR_WIDTH;
const NUMBER_ROW = 116;
/** Where the timeline glides to on first view, showing that it can be dragged. */
const DEMO_YEARS = 1;
/** Silence before the clip starts: flat dots, so year zero doesn't begin in empty space. */
const PRE_ROLL_DOTS = 3 * BARS_PER_YEAR;
const PRE_ROLL_WIDTH = PRE_ROLL_DOTS * BAR_STEP;
const MAX_OFFSET = YEARS_MAX * YEAR_WIDTH;
const RUBBER_BAND = 0.35;
/** How far a fling carries past the release point, in seconds of its velocity. */
const FLING_CARRY = 0.18;
const ACCESSIBILITY_ACTIONS = [{ name: "increment" }, { name: "decrement" }];

/**
 * A clip that gets louder the further in it goes: your sound growing with the years. One
 * path of round-capped strokes, so the whole waveform is a single native view.
 */
const WAVE_PATH = Array.from({ length: BAR_COUNT }, (_, index) => {
  const position = index / (BAR_COUNT - 1);
  const envelope = 0.2 + 0.8 * position ** 0.65;
  const wobble = 0.5 + 0.5 * Math.abs(Math.sin(index * 1.7) * Math.cos(index * 0.63 + 1));
  const height = Math.max(6, WAVE_HEIGHT * BAR_REACH * envelope * wobble);
  const x = BAR_WIDTH / 2 + index * BAR_STEP;
  const top = (WAVE_HEIGHT - height) / 2 + BAR_WIDTH / 2;
  return `M ${x} ${top} L ${x} ${top + height - BAR_WIDTH}`;
}).join(" ");

/** Zero-length round-capped strokes draw as dots. */
const SILENCE_PATH = Array.from({ length: PRE_ROLL_DOTS }, (_, index) => {
  const x = BAR_WIDTH / 2 + index * BAR_STEP;
  return `M ${x} ${WAVE_HEIGHT / 2} L ${x} ${WAVE_HEIGHT / 2}`;
}).join(" ");

function yearsLabel(years: number): string {
  if (years <= 0) return "<1";
  if (years >= YEARS_MAX) return `${YEARS_MAX}+`;
  return String(years);
}

function Waveform({ color }: { color: string }) {
  return (
    <Svg width={CLIP_WIDTH} height={WAVE_HEIGHT}>
      <Path d={WAVE_PATH} stroke={color} strokeWidth={BAR_WIDTH} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Everything that scrolls. It never re-renders: the lit part follows the scroll through
 * transforms only, a window sliding one way and the orange clip inside it the other.
 */
const Track = memo(function Track({
  scrollX,
  origin,
}: {
  scrollX: SharedValue<number>;
  /** Where year zero sits when the clip is at rest: under the playhead. */
  origin: number;
}) {
  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollX.get() }],
  }));
  const windowStyle = useAnimatedStyle(() => {
    const played = Math.max(0, Math.min(CLIP_WIDTH, scrollX.get() + BAR_WIDTH / 2));
    return { transform: [{ translateX: played - CLIP_WIDTH }] };
  });
  const clipStyle = useAnimatedStyle(() => {
    const played = Math.max(0, Math.min(CLIP_WIDTH, scrollX.get() + BAR_WIDTH / 2));
    return { transform: [{ translateX: CLIP_WIDTH - played }] };
  });

  return (
    <Animated.View style={[styles.track, { left: origin }, trackStyle]}>
      <View style={styles.silence}>
        <Svg width={PRE_ROLL_WIDTH} height={WAVE_HEIGHT}>
          <Path d={SILENCE_PATH} stroke="#262626" strokeWidth={BAR_WIDTH} strokeLinecap="round" />
        </Svg>
      </View>
      <View style={styles.clip}>
        <Waveform color="#2a2a2a" />
      </View>
      <Animated.View style={[styles.clip, styles.playedWindow, windowStyle]}>
        <Animated.View style={clipStyle}>
          <Waveform color={colors.primary} />
        </Animated.View>
      </Animated.View>
      {Array.from({ length: YEARS_MAX + 1 }, (_, index) => (
        <View key={index} style={[styles.rulerMark, { left: index * YEAR_WIDTH - 20 }]}>
          <View style={styles.rulerTick} />
          <Text style={styles.rulerLabel}>{yearsLabel(index)}</Text>
        </View>
      ))}
    </Animated.View>
  );
});

/**
 * One number on the odometer. Its place follows the scroll position frame by frame, so the
 * readout rolls with the finger instead of swapping once per year.
 */
const OdometerDigit = memo(function OdometerDigit({
  value,
  scrollX,
}: {
  value: number;
  scrollX: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const position = Math.max(0, Math.min(YEARS_MAX, scrollX.get() / YEAR_WIDTH));
    const offset = value - position;
    const distance = Math.abs(offset);
    return {
      opacity: interpolate(distance, [0, 0.8], [1, 0], "clamp"),
      transform: [
        { translateY: offset * NUMBER_ROW },
        { scale: interpolate(distance, [0, 1], [1, 0.85], "clamp") },
      ],
    };
  });
  return <Animated.Text style={[styles.number, style]}>{yearsLabel(value)}</Animated.Text>;
});

/** Past either end the clip still follows the finger, but only a third as far. */
function rubberBand(offset: number): number {
  "worklet";
  if (offset < 0) return offset * RUBBER_BAND;
  if (offset > MAX_OFFSET) return MAX_OFFSET + (offset - MAX_OFFSET) * RUBBER_BAND;
  return offset;
}

function yearAt(offset: number): number {
  "worklet";
  return Math.max(0, Math.min(YEARS_MAX, Math.round(offset / YEAR_WIDTH)));
}

/**
 * "How long have you been producing?" as a DAW timeline: drag the clip under a fixed
 * playhead, one year per snap. The played part lights up, each year ticks, and crossing into
 * a new experience bucket bumps a little harder.
 *
 * Driven by a pan gesture rather than a scroll view: dragging, the fling and the snap all run
 * on the UI thread with one spring, and the answer is saved as soon as the target year is
 * known, so nothing outside this component re-renders mid-drag.
 */
export function ExperienceTimeline({
  years: savedYears,
  onChange,
}: {
  years: number | undefined;
  onChange: (years: number) => void;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  // Read once: saving the starting answer below fills in `savedYears` straight away.
  const [initial] = useState(() => ({ years: savedYears ?? 0, firstVisit: savedYears == null }));
  const [years, setYears] = useState(initial.years);
  const [dragged, setDragged] = useState(!initial.firstVisit);
  const shown = useRef(initial.years);
  const committed = useRef(savedYears);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const offset = useSharedValue(initial.years * YEAR_WIDTH);
  const dragStart = useSharedValue(0);

  const commit = useCallback((next: number) => {
    if (committed.current === next) return;
    committed.current = next;
    onChangeRef.current(next);
  }, []);

  const glideTo = useCallback(
    (next: number) => {
      offset.set(
        withTiming(next * YEAR_WIDTH, { duration: 650, easing: Easing.out(Easing.cubic) }),
      );
      commit(next);
    },
    [commit, offset],
  );

  // A fresh answer starts at "<1", so Continue works even if the glide below is cut short.
  useEffect(() => {
    if (initial.firstVisit) commit(0);
  }, [commit, initial.firstVisit]);

  // First visit: glide in from the start so it's obvious the timeline moves.
  useEffect(() => {
    if (!initial.firstVisit) return;
    const glide = setTimeout(() => glideTo(DEMO_YEARS), 450);
    return () => clearTimeout(glide);
  }, [glideTo, initial.firstVisit]);

  const onTick = useCallback((next: number) => {
    const previous = shown.current;
    shown.current = next;
    setYears(next);
    const done =
      experienceFromYears(next) !== experienceFromYears(previous)
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : Haptics.selectionAsync();
    void done.catch(() => undefined);
  }, []);

  useAnimatedReaction(
    () => yearAt(offset.get()),
    (next, previous) => {
      if (previous != null && next !== previous) scheduleOnRN(onTick, next);
    },
  );

  const pan = useMemo(() => {
    const snap = (from: number, velocityX: number) => {
      "worklet";
      // Carry the fling a little further, then let one spring land it on a year.
      const target = yearAt(from - velocityX * FLING_CARRY);
      offset.set(
        withSpring(target * YEAR_WIDTH, {
          damping: 26,
          stiffness: 210,
          mass: 0.8,
          velocity: -velocityX,
        }),
      );
      scheduleOnRN(commit, target);
    };
    return Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onBegin(() => {
        // Catch the clip mid-glide or mid-snap.
        cancelAnimation(offset);
      })
      .onStart(() => {
        dragStart.set(offset.get());
        scheduleOnRN(setDragged, true);
      })
      .onUpdate((event) => {
        offset.set(rubberBand(dragStart.get() - event.translationX));
      })
      .onEnd((event) => {
        snap(offset.get(), event.velocityX);
      })
      .onFinalize((_event, success) => {
        // A touch that never became a drag may have stopped a glide halfway: finish the snap.
        if (!success) snap(offset.get(), 0);
      });
  }, [commit, dragStart, offset]);

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const delta = event.nativeEvent.actionName === "increment" ? 1 : -1;
    glideTo(Math.max(0, Math.min(YEARS_MAX, years + delta)));
  };

  const unit = t("onboarding.quiz.experience.yearsUnit", { count: Math.max(1, years) });

  return (
    <View style={styles.root}>
      <View style={styles.readout}>
        <View style={styles.numberBox}>
          {Array.from({ length: YEARS_MAX + 1 }, (_, value) => (
            <OdometerDigit key={value} value={value} scrollX={offset} />
          ))}
        </View>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      <GestureDetector gesture={pan}>
        <View
          style={styles.timeline}
          onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t("onboarding.quiz.experience.timelineA11y")}
          accessibilityValue={{ text: `${yearsLabel(years)} ${unit}` }}
          accessibilityActions={ACCESSIBILITY_ACTIONS}
          onAccessibilityAction={onAccessibilityAction}
        >
          {width > 0 ? <Track scrollX={offset} origin={width / 2} /> : null}

          {/* The fixed playhead, with the clip fading out towards both edges. */}
          <LinearGradient
            pointerEvents="none"
            colors={[colors.background, "rgba(10,10,10,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.edgeFade, styles.edgeLeft]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(10,10,10,0)", colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.edgeFade, styles.edgeRight]}
          />
          <View pointerEvents="none" style={styles.playhead}>
            <View style={styles.playheadCap} />
            <View style={styles.playheadLine} />
          </View>
        </View>
      </GestureDetector>

      {!dragged ? (
        <Animated.Text entering={FadeIn.delay(900)} exiting={FadeOut} style={styles.hint}>
          {t("onboarding.quiz.experience.dragHint")}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 36,
  },
  readout: {
    alignItems: "center",
    marginBottom: 40,
  },
  numberBox: {
    height: NUMBER_ROW,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  number: {
    position: "absolute",
    fontFamily: fontFamily.heading,
    fontSize: 108,
    lineHeight: NUMBER_ROW,
    letterSpacing: -4,
    color: colors.textPrimary,
  },
  unit: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 17,
    color: colors.textSecondary,
    marginTop: -2,
  },
  // Full-bleed: undo the question's side padding so the clip runs edge to edge.
  timeline: {
    marginHorizontal: -20,
    height: WAVE_HEIGHT + RULER_HEIGHT + PLAYHEAD_CAP_ROOM,
    overflow: "hidden",
  },
  track: {
    position: "absolute",
    top: PLAYHEAD_CAP_ROOM,
    width: YEARS_MAX * YEAR_WIDTH,
    height: WAVE_HEIGHT + RULER_HEIGHT,
  },
  silence: {
    position: "absolute",
    top: 0,
    left: -PRE_ROLL_WIDTH - BAR_WIDTH / 2,
  },
  clip: {
    position: "absolute",
    top: 0,
    left: -BAR_WIDTH / 2,
    width: CLIP_WIDTH,
    height: WAVE_HEIGHT,
  },
  playedWindow: {
    overflow: "hidden",
  },
  rulerMark: {
    position: "absolute",
    top: WAVE_HEIGHT + 8,
    width: 40,
    alignItems: "center",
  },
  rulerTick: {
    width: 1.5,
    height: 8,
    borderRadius: 1,
    backgroundColor: "#3a3a3a",
    marginBottom: 4,
  },
  rulerLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    color: "#5a5a5a",
  },
  edgeFade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 64,
  },
  edgeLeft: {
    left: 0,
  },
  edgeRight: {
    right: 0,
  },
  playhead: {
    position: "absolute",
    top: 0,
    left: "50%",
    width: 14,
    marginLeft: -7,
    height: WAVE_HEIGHT + PLAYHEAD_CAP_ROOM,
    alignItems: "center",
  },
  playheadCap: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: colors.primary,
    transform: [{ rotate: "45deg" }],
    marginBottom: -6,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  playheadLine: {
    flex: 1,
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  hint: {
    marginTop: 14,
    textAlign: "center",
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
