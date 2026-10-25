import { type ReactElement, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { LinearGradient } from "expo-linear-gradient";

import type { SessionType } from "../../constants/sessionTypes";
import { colors } from "../../constants/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The motif's drawing area on the right side of the selected card. */
const W = 150;
const H = 60;
/** One loop of every motif's motion. */
const LOOP_MS = 2400;
/** Width of the fade on the motif's left edge, where it meets the type's name. */
const FADE = 64;
/**
 * The selected card's tint ramps from accent at 0x12 alpha (left) to 0x2e (right) over the
 * surface; the motif starts a little past the middle, so its fade matches the tint there.
 */
const TINT_FROM = 0x12;
const TINT_TO = 0x2e;
const MOTIF_START = 0.56;

function cardTintAt(accent: string, fraction: number): string {
  const alpha = (TINT_FROM + (TINT_TO - TINT_FROM) * fraction) / 255;
  const channel = (hex: string, offset: number) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16);
  const mix = (offset: number) =>
    Math.round(channel(colors.surface, offset) * (1 - alpha) + channel(accent, offset) * alpha)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

type MotifProps = { accent: string; phase: SharedValue<number> };

/** 4×3 drum pads with a sequencer step lighting one column after the other. */
function DrumPads({ accent, phase }: MotifProps) {
  const pattern = [
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 0, 0, 1],
  ];
  return (
    <View style={motif.pads}>
      {pattern.map((row, r) => (
        <View key={r} style={motif.padRow}>
          {row.map((on, c) => (
            <Pad key={c} column={c} on={on === 1} accent={accent} phase={phase} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Pad({ column, on, accent, phase }: MotifProps & { column: number; on: boolean }) {
  const style = useAnimatedStyle(() => {
    const step = Math.floor(phase.get() * 4) % 4;
    return { opacity: step === column ? (on ? 1 : 0.55) : on ? 0.45 : 0.16 };
  });
  return <Animated.View style={[motif.pad, { backgroundColor: accent }, style]} />;
}

/** Six channel faders, each cap gliding at its own pace. */
function Faders({ accent, phase }: MotifProps) {
  return (
    <View style={motif.faders}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Fader key={i} index={i} accent={accent} phase={phase} />
      ))}
    </View>
  );
}

function Fader({ index, accent, phase }: MotifProps & { index: number }) {
  const base = [8, -10, 2, -16, 12, -4][index] ?? 0;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: base + Math.sin(phase.get() * Math.PI * 2 + index * 1.1) * 7 }],
  }));
  return (
    <View style={motif.faderTrack}>
      <View style={[motif.faderLine, { backgroundColor: accent }]} />
      <Animated.View style={[motif.faderCap, { backgroundColor: accent }, style]} />
    </View>
  );
}

/** A record spinning half off the edge. */
function Vinyl({ accent, phase }: MotifProps) {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${phase.get() * 360}deg` }],
  }));
  const size = 140;
  const c = size / 2;
  return (
    <Animated.View style={[motif.vinyl, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        {[66, 56, 46, 36].map((r) => (
          <Circle
            key={r}
            cx={c}
            cy={c}
            r={r}
            stroke={accent}
            strokeOpacity={0.35}
            strokeWidth={1}
            fill="none"
          />
        ))}
        <Circle
          cx={c}
          cy={c}
          r={60}
          stroke={accent}
          strokeOpacity={0.7}
          strokeWidth={2}
          strokeDasharray="22 160"
          fill="none"
        />
        <Circle cx={c} cy={c} r={16} fill={accent} fillOpacity={0.45} />
        <Circle cx={c} cy={c} r={3} fill="#0a0a0a" />
      </Svg>
    </Animated.View>
  );
}

/** An EQ curve with its band nodes, breathing as if the audio moves it. */
function EqCurve({ accent, phase }: MotifProps) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: 0.85 + 0.2 * Math.sin(phase.get() * Math.PI * 2) }],
  }));
  const d = `M 0 ${H * 0.62} C 25 ${H * 0.62}, 30 ${H * 0.2}, 55 ${H * 0.22} S 85 ${H * 0.75}, 105 ${H * 0.66} S 135 ${H * 0.3}, ${W} ${H * 0.34}`;
  return (
    <Animated.View style={style}>
      <Svg width={W} height={H}>
        <Line
          x1={0}
          y1={H / 2}
          x2={W}
          y2={H / 2}
          stroke={accent}
          strokeOpacity={0.2}
          strokeDasharray="3 5"
        />
        <Path d={d} stroke={accent} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {[
          [55, H * 0.22],
          [105, H * 0.66],
        ].map(([x, y]) => (
          <Circle key={x} cx={x} cy={y} r={5} fill="#0a0a0a" stroke={accent} strokeWidth={2} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** An oscilloscope trace scrolling past, like a synth patch being shaped. */
function Oscilloscope({ accent, phase }: MotifProps) {
  const points: string[] = [];
  for (let x = 0; x <= W * 2; x += 3) {
    const t = (x / W) * Math.PI * 4;
    const y = H / 2 - (Math.sin(t) * 0.7 + Math.sin(t * 3) * 0.25) * (H * 0.36);
    points.push(`${x === 0 ? "M" : "L"} ${x} ${y.toFixed(1)}`);
  }
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -phase.get() * W }] }));
  return (
    <View style={motif.clip}>
      <Animated.View style={style}>
        <Svg width={W * 2} height={H}>
          <Path
            d={points.join(" ")}
            stroke={accent}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** An input level meter bouncing on the mic signal, peaking into red at the top. */
function LevelMeter({ accent, phase }: MotifProps) {
  return (
    <View style={motif.meter}>
      {Array.from({ length: 14 }, (_, i) => (
        <MeterSegment key={i} index={i} accent={accent} phase={phase} />
      ))}
    </View>
  );
}

function MeterSegment({ index, accent, phase }: MotifProps & { index: number }) {
  const hot = index >= 11;
  const style = useAnimatedStyle(() => {
    const p = phase.get() * Math.PI * 2;
    const level = 7 + 4 * Math.sin(p * 2) + 2.5 * Math.sin(p * 5 + 1);
    return { opacity: index < level ? 1 : 0.15 };
  });
  return (
    <Animated.View style={[motif.segment, { backgroundColor: hot ? "#ff4444" : accent }, style]} />
  );
}

/** Ruled paper with a line of handwriting writing itself. */
function Handwriting({ accent, phase }: MotifProps) {
  const ink =
    "M 6 40 C 14 22, 20 22, 22 34 S 30 46, 36 30 S 46 18, 50 34 S 60 48, 66 30 S 76 20, 82 36 S 94 44, 100 28 S 112 22, 118 36 S 130 40, 140 30";
  const length = 260;
  const props = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - Math.min(1, phase.get() * 1.25)),
  }));
  return (
    <Svg width={W} height={H}>
      {[14, 30, 46].map((y) => (
        <Line key={y} x1={0} y1={y + 8} x2={W} y2={y + 8} stroke={accent} strokeOpacity={0.18} />
      ))}
      <AnimatedPath
        d={ink}
        stroke={accent}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={[length, length]}
        animatedProps={props}
      />
    </Svg>
  );
}

/** Clips on three lanes, with a playhead sweeping across the arrangement. */
function Arrangement({ accent, phase }: MotifProps) {
  const clips = [
    [0, 0, 46],
    [52, 0, 60],
    [118, 0, 32],
    [14, 1, 70],
    [92, 1, 50],
    [0, 2, 30],
    [36, 2, 38],
    [80, 2, 64],
  ];
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: phase.get() * W }] }));
  return (
    <View style={motif.clip}>
      <Svg width={W} height={H}>
        {clips.map(([x, lane, w]) => (
          <Rect
            key={`${x}-${lane}`}
            x={x}
            y={6 + (lane ?? 0) * 18}
            width={w}
            height={13}
            rx={4}
            fill={accent}
            fillOpacity={lane === 1 ? 0.55 : 0.32}
          />
        ))}
      </Svg>
      <Animated.View style={[motif.playhead, style]} />
    </View>
  );
}

/** Pitch correction: a wobbly sung line and the clean stepped notes it snaps to. */
function PitchCorrection({ accent, phase }: MotifProps) {
  const steps = "M 0 40 H 30 V 26 H 62 V 34 H 92 V 18 H 122 V 30 H 150";
  const sung =
    "M 0 43 C 10 37, 20 44, 30 38 C 36 22, 50 30, 62 25 C 70 38, 84 31, 92 34 C 98 14, 112 22, 122 17 C 130 32, 142 27, 150 31";
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: phase.get() * (W - 10) }] }));
  return (
    <View style={motif.clip}>
      <Svg width={W} height={H}>
        <Path
          d={sung}
          stroke={accent}
          strokeOpacity={0.35}
          strokeWidth={2}
          fill="none"
          strokeDasharray="3 4"
        />
        <Path d={steps} stroke={accent} strokeWidth={3} fill="none" strokeLinejoin="round" />
      </Svg>
      <Animated.View
        style={[motif.noteDot, { backgroundColor: accent, shadowColor: accent }, style]}
      />
    </View>
  );
}

/** Stacked track lanes with little regions, the whole project rolling by. */
function TrackLanes({ accent, phase }: MotifProps) {
  const lanes = [0, 1, 2, 3];
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -phase.get() * W }] }));
  return (
    <View style={motif.clip}>
      <Animated.View style={style}>
        <Svg width={W * 2} height={H}>
          {lanes.map((lane) =>
            Array.from({ length: 6 }, (_, i) => {
              const x = ((i * 53 + lane * 29) % (W * 2)) + 4;
              const w = 26 + ((i + lane) % 3) * 12;
              return (
                <Rect
                  key={`${lane}-${i}`}
                  x={x}
                  y={4 + lane * 14}
                  width={w}
                  height={9}
                  rx={3}
                  fill={accent}
                  fillOpacity={0.22 + (lane % 2) * 0.2}
                />
              );
            }),
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

/** A small skill graph, one node lighting up after another. */
function SkillGraph({ accent, phase }: MotifProps) {
  const nodes = [
    [14, 32],
    [48, 12],
    [52, 48],
    [90, 28],
    [124, 10],
    [128, 46],
  ];
  const links = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [3, 5],
  ];
  return (
    <View>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        {links.map(([a, b]) => {
          const [x1, y1] = nodes[a ?? 0] ?? [0, 0];
          const [x2, y2] = nodes[b ?? 0] ?? [0, 0];
          return (
            <Line
              key={`${a}-${b}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={accent}
              strokeOpacity={0.35}
              strokeWidth={1.5}
            />
          );
        })}
      </Svg>
      <View style={{ width: W, height: H }}>
        {nodes.map(([x, y], i) => (
          <GraphNode key={i} index={i} x={x ?? 0} y={y ?? 0} accent={accent} phase={phase} />
        ))}
      </View>
    </View>
  );
}

function GraphNode({
  index,
  x,
  y,
  accent,
  phase,
}: MotifProps & { index: number; x: number; y: number }) {
  const style = useAnimatedStyle(() => {
    const lit = Math.floor(phase.get() * 6) % 6;
    return {
      opacity: lit === index ? 1 : 0.4,
      transform: [{ scale: lit === index ? 1.25 : 1 }],
    };
  });
  return (
    <Animated.View
      style={[
        motif.node,
        { left: x - 6, top: y - 6, backgroundColor: accent, shadowColor: accent },
        style,
      ]}
    />
  );
}

const MOTIFS: Record<SessionType, (props: MotifProps) => ReactElement> = {
  production: TrackLanes,
  beat_making: DrumPads,
  mixing: Faders,
  mastering: Vinyl,
  mix_and_master: EqCurve,
  sound_design: Oscilloscope,
  recording: LevelMeter,
  songwriting: Handwriting,
  arrangement: Arrangement,
  vocal_production: PitchCorrection,
  learning: SkillGraph,
};

/**
 * What a session type is about, drawn small in its colour on the selected card: pads for
 * beats, faders for mixing, a spinning record for mastering… It slides in when the type is
 * picked and keeps a gentle loop going while selected.
 */
export function SessionTypeMotif({ type, accent }: { type: SessionType; accent: string }) {
  const phase = useSharedValue(0);
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    phase.set(withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1));
  }, [enter, phase]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: 0.85 * enter.get(),
    transform: [{ translateX: (1 - enter.get()) * 24 }],
  }));

  const Motif = MOTIFS[type];
  const tint = cardTintAt(accent, MOTIF_START);
  return (
    <View style={motif.root} pointerEvents="none">
      <Animated.View style={[motif.art, enterStyle]}>
        <Motif accent={accent} phase={phase} />
      </Animated.View>
      {/* Dissolves the motif before it reaches the type's name, whatever the motif's shape. */}
      <LinearGradient
        colors={[tint, `${tint}00`]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={motif.fade}
      />
    </View>
  );
}

const motif = StyleSheet.create({
  root: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    width: W,
  },
  art: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  fade: { position: "absolute", left: -8, top: 0, bottom: 0, width: FADE },
  clip: { width: W, height: H, overflow: "hidden" },
  pads: { gap: 6 },
  padRow: { flexDirection: "row", gap: 6 },
  pad: { width: 16, height: 16, borderRadius: 4 },
  faders: { flexDirection: "row", gap: 16, height: H, alignItems: "center" },
  faderTrack: { width: 14, height: H, alignItems: "center", justifyContent: "center" },
  faderLine: { position: "absolute", width: 2, height: H, borderRadius: 1, opacity: 0.25 },
  faderCap: { width: 14, height: 8, borderRadius: 3 },
  vinyl: { position: "absolute", right: -70 },
  meter: { flexDirection: "row", gap: 4, alignItems: "center", height: H },
  segment: { width: 6, height: 26, borderRadius: 2 },
  playhead: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#ffffff",
    opacity: 0.85,
  },
  noteDot: {
    position: "absolute",
    left: 0,
    top: H / 2 - 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  node: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
