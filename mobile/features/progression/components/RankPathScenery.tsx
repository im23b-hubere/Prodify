import { LinearGradient } from "expo-linear-gradient";
import { type ComponentType, memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  Line,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import type { LevelTierId, LevelTierTheme } from "../../../lib/progressionLevelTheme";
import { type RankPathLayout, rankPathCapColors, tierZoneTint } from "../rankPathLayout";

type Zone = {
  tier: LevelTierTheme;
  top: number;
  bottom: number;
  centerY: number;
  /** The side of the screen the path leaves free in this zone; the motif goes there. */
  freeSide: "left" | "right";
};

type MotifProps = { zone: Zone; width: number; nodes: RankPathLayout["nodes"] };

/** Deterministic pseudo-random in [0, 1) so decorations never reshuffle between renders. */
function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function sparklePath(x: number, y: number, size: number): string {
  // Four-point star with pinched, curved sides.
  return [
    `M ${x} ${y - size}`,
    `Q ${x} ${y} ${x + size} ${y}`,
    `Q ${x} ${y} ${x} ${y + size}`,
    `Q ${x} ${y} ${x - size} ${y}`,
    `Q ${x} ${y} ${x} ${y - size}`,
    "Z",
  ].join(" ");
}

/** Starter: a vinyl record half off the edge, like the first one you ever sampled. */
function VinylMotif({ zone, width }: MotifProps) {
  const radius = 150;
  const cx = zone.freeSide === "left" ? -30 : width + 30;
  const { accent } = zone.tier;
  return (
    <G opacity={0.9}>
      <Circle cx={cx} cy={zone.centerY} r={radius} fill={accent} opacity={0.05} />
      {Array.from({ length: 11 }, (_, index) => (
        <Circle
          key={index}
          cx={cx}
          cy={zone.centerY}
          r={radius - 8 - index * 8}
          stroke={accent}
          strokeOpacity={index % 3 === 0 ? 0.12 : 0.06}
          strokeWidth={1}
          fill="none"
        />
      ))}
      <Circle cx={cx} cy={zone.centerY} r={38} fill={accent} opacity={0.14} />
      <Circle cx={cx} cy={zone.centerY} r={5} fill="#0a0a0a" opacity={0.6} />
    </G>
  );
}

/** Builder: layered waveforms drifting across the zone. */
function WaveMotif({ zone, width }: MotifProps) {
  const lines = [
    { offset: -34, amplitude: 12, wavelength: 110, phase: 0, opacity: 0.07 },
    { offset: 0, amplitude: 22, wavelength: 150, phase: 1.3, opacity: 0.11 },
    { offset: 34, amplitude: 14, wavelength: 90, phase: 2.4, opacity: 0.07 },
  ];
  return (
    <G>
      {lines.map((line) => {
        const y = zone.centerY + line.offset;
        const points = Array.from({ length: Math.ceil(width / 6) + 1 }, (_, index) => {
          const x = index * 6;
          // Fade the swing in and out at the screen edges so the wave feels like a signal.
          const envelope = Math.sin((x / width) * Math.PI);
          const dy =
            Math.sin((x / line.wavelength) * Math.PI * 2 + line.phase) * line.amplitude * envelope;
          return `${index === 0 ? "M" : "L"} ${x} ${y + dy}`;
        });
        return (
          <Path
            key={line.offset}
            d={points.join(" ")}
            stroke={zone.tier.accent}
            strokeOpacity={line.opacity}
            strokeWidth={2}
            fill="none"
          />
        );
      })}
    </G>
  );
}

/** Engineer: a bank of mixer faders on the free side. */
function FaderMotif({ zone, width }: MotifProps) {
  const tracks = 5;
  const gap = 22;
  const height = 210;
  const startX = zone.freeSide === "left" ? 22 : width - 22 - gap * (tracks - 1);
  const top = zone.centerY - height / 2;
  const { accent } = zone.tier;
  return (
    <G>
      {Array.from({ length: tracks }, (_, index) => {
        const x = startX + index * gap;
        const knobY = top + 24 + seeded(index, 3) * (height - 60);
        return (
          <G key={index}>
            <Line
              x1={x}
              x2={x}
              y1={top}
              y2={top + height}
              stroke={accent}
              strokeOpacity={0.12}
              strokeWidth={2}
              strokeLinecap="round"
            />
            {Array.from({ length: 6 }, (_, tick) => (
              <Line
                key={tick}
                x1={x - 5}
                x2={x - 2}
                y1={top + 12 + tick * 37}
                y2={top + 12 + tick * 37}
                stroke={accent}
                strokeOpacity={0.1}
                strokeWidth={1}
              />
            ))}
            <Rect x={x - 8} y={knobY} width={16} height={9} rx={2.5} fill={accent} opacity={0.2} />
          </G>
        );
      })}
    </G>
  );
}

/** Pro: a speaker cone pushing sound rings into the zone. */
function SpeakerMotif({ zone, width }: MotifProps) {
  const cx = zone.freeSide === "left" ? -10 : width + 10;
  const { accent } = zone.tier;
  return (
    <G>
      {[170, 205, 240].map((radius, index) => (
        <Circle
          key={radius}
          cx={cx}
          cy={zone.centerY}
          r={radius}
          stroke={accent}
          strokeOpacity={0.09 - index * 0.025}
          strokeWidth={2}
          fill="none"
        />
      ))}
      <Circle
        cx={cx}
        cy={zone.centerY}
        r={122}
        stroke={accent}
        strokeOpacity={0.12}
        strokeWidth={8}
        fill="none"
      />
      <Circle cx={cx} cy={zone.centerY} r={112} fill={`url(#speaker-cone-${zone.tier.id})`} />
      <Circle cx={cx} cy={zone.centerY} r={34} fill={accent} opacity={0.14} />
    </G>
  );
}

/** Legend: sparkles scattered through the zone, kept clear of the rank labels. */
function SparkleMotif({ zone, width, nodes }: MotifProps) {
  const summit = nodes.at(-1);
  const sparkles = Array.from({ length: 48 }, (_, index) => ({
    index,
    x: 16 + seeded(index, 7) * (width - 32),
    y: zone.top - 60 + seeded(index, 11) * (zone.bottom - zone.top + 160),
  }))
    .filter(({ x, y }) => {
      const nearRankRow = nodes.some((node) => Math.abs(node.y - y) < 40);
      const inSummitTitle =
        summit != null && y > summit.y - 220 && y < summit.y + 70 && Math.abs(x - summit.x) < 170;
      return !nearRankRow && !inSummitTitle;
    })
    .slice(0, 14);
  return (
    <G>
      {sparkles.map(({ index, x, y }) => (
        <Path
          key={index}
          d={sparklePath(x, y, 3 + seeded(index, 13) * 5)}
          fill={index % 4 === 0 ? "#ffffff" : zone.tier.accent}
          opacity={0.18 + seeded(index, 17) * 0.3}
        />
      ))}
    </G>
  );
}

const MOTIFS: Record<LevelTierId, ComponentType<MotifProps>> = {
  starter: VinylMotif,
  builder: WaveMotif,
  engineer: FaderMotif,
  pro: SpeakerMotif,
  legend: SparkleMotif,
};

/** Spotlights, halo and a lit stage floor for the final rank. */
function SummitStage({ layout }: { layout: RankPathLayout }) {
  const summit = layout.nodes.at(-1);
  if (!summit) return null;
  const { accent } = summit.tier;
  const floorY = summit.y + 52;
  const beams = [
    { fromX: layout.width * 0.12, spread: 70 },
    { fromX: layout.width * 0.88, spread: 70 },
    { fromX: layout.width * 0.5, spread: 54 },
  ];
  return (
    <G>
      <Circle cx={summit.x} cy={summit.y} r={layout.width * 0.62} fill="url(#summit-halo)" />
      {beams.map((beam) => (
        <Polygon
          key={beam.fromX}
          points={[
            `${beam.fromX - 6},0`,
            `${beam.fromX + 6},0`,
            `${summit.x + beam.spread},${floorY}`,
            `${summit.x - beam.spread},${floorY}`,
          ].join(" ")}
          fill="url(#summit-beam)"
        />
      ))}
      <Ellipse cx={summit.x} cy={floorY} rx={110} ry={16} fill={accent} opacity={0.12} />
      <Ellipse cx={summit.x} cy={floorY} rx={62} ry={8} fill={accent} opacity={0.2} />
    </G>
  );
}

/**
 * Everything behind the trail: tier-tinted zones with soft glows, one music motif per tier on
 * the side the path leaves free, and a spotlit stage for the summit.
 */
export const RankPathScenery = memo(function RankPathScenery({
  layout,
}: {
  layout: RankPathLayout;
}) {
  const { width, height, nodes } = layout;
  const summit = nodes.at(-1);

  const zones = useMemo<Zone[]>(() => {
    const byTier = new Map<LevelTierId, { tier: LevelTierTheme; xs: number[]; ys: number[] }>();
    for (const node of nodes) {
      const entry = byTier.get(node.tier.id) ?? { tier: node.tier, xs: [], ys: [] };
      entry.xs.push(node.x);
      entry.ys.push(node.y);
      byTier.set(node.tier.id, entry);
    }
    return [...byTier.values()]
      .map(({ tier, xs, ys }) => {
        const averageX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
        return {
          tier,
          top: Math.min(...ys),
          bottom: Math.max(...ys),
          centerY: ys.reduce((sum, y) => sum + y, 0) / ys.length,
          freeSide: averageX > width / 2 ? ("left" as const) : ("right" as const),
        };
      })
      .sort((a, b) => a.centerY - b.centerY);
  }, [nodes, width]);

  const gradient = useMemo(() => {
    const top = zones[0];
    if (!top) return null;
    // Caps match rankPathCapColors so the screen's safe areas continue the backdrop seamlessly.
    const caps = rankPathCapColors(layout);
    const zoneColors: [string, string, ...string[]] = [
      caps.top,
      tierZoneTint(top.tier.accent),
      ...zones.slice(1).map((zone) => tierZoneTint(zone.tier.accent)),
      caps.bottom,
    ];
    const zoneStops: [number, number, ...number[]] = [
      0,
      top.centerY / height,
      ...zones.slice(1).map((zone) => zone.centerY / height),
      1,
    ];
    return { colors: zoneColors, locations: zoneStops };
  }, [height, layout, zones]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {gradient ? (
        <LinearGradient
          colors={gradient.colors}
          locations={gradient.locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {zones.map(({ tier }) => (
            <RadialGradient key={tier.id} id={`zone-glow-${tier.id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tier.accent} stopOpacity={0.18} />
              <Stop offset="1" stopColor={tier.accent} stopOpacity={0} />
            </RadialGradient>
          ))}
          {zones.map(({ tier }) => (
            <RadialGradient key={tier.id} id={`speaker-cone-${tier.id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.25" stopColor={tier.accent} stopOpacity={0.02} />
              <Stop offset="1" stopColor={tier.accent} stopOpacity={0.12} />
            </RadialGradient>
          ))}
          {summit ? (
            <>
              <RadialGradient id="summit-halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={summit.tier.accent} stopOpacity={0.3} />
                <Stop offset="1" stopColor={summit.tier.accent} stopOpacity={0} />
              </RadialGradient>
              {/* Beams fade in from nothing, so over-scrolling never shows a hard top edge. */}
              <SvgLinearGradient id="summit-beam" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={summit.tier.accent} stopOpacity={0} />
                <Stop offset="0.35" stopColor={summit.tier.accent} stopOpacity={0.13} />
                <Stop offset="1" stopColor={summit.tier.accent} stopOpacity={0.02} />
              </SvgLinearGradient>
            </>
          ) : null}
        </Defs>

        {zones.map((zone) => (
          <Circle
            key={zone.tier.id}
            cx={zone.freeSide === "left" ? width * 0.1 : width * 0.9}
            cy={zone.centerY}
            r={width * 0.75}
            fill={`url(#zone-glow-${zone.tier.id})`}
          />
        ))}

        {zones.map((zone) => {
          const Motif = MOTIFS[zone.tier.id];
          return <Motif key={zone.tier.id} zone={zone} width={width} nodes={nodes} />;
        })}

        <SummitStage layout={layout} />
      </Svg>
    </View>
  );
});
