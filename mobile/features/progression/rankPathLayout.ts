import { PROGRESSION_NAMED_LEVEL_MAX } from "../../lib/progressionLevels";
import { type LevelTierTheme, levelTierFor } from "../../lib/progressionLevelTheme";

const NODE_GAP = 124;
/** Extra room where one tier hands over to the next, so the tier gate banner has space. */
const TIER_GAP = 92;
/** Room above the summit for its title and spotlight beams. */
const TOP_PAD = 250;
const BOTTOM_PAD = 130;
const SWING_RATIO = 0.22;
const SWING_MAX = 110;

export type RankPathPoint = { x: number; y: number };

export type RankPathNode = RankPathPoint & {
  level: number;
  tier: LevelTierTheme;
  /** Which side of the node its label sits on: away from the centre line. */
  labelSide: "left" | "right";
};

export type RankPathSegment = {
  /** Level the segment starts at; it leads to `fromLevel + 1`. */
  fromLevel: number;
  tier: LevelTierTheme;
  from: RankPathPoint;
  to: RankPathPoint;
  d: string;
  length: number;
};

export type RankPathGate = { tier: LevelTierTheme; y: number; fromLevel: number; toLevel: number };

export type RankPathLayout = {
  width: number;
  height: number;
  nodes: RankPathNode[];
  segments: RankPathSegment[];
  gates: RankPathGate[];
  /** Whole path as one `d` string, bottom (level 1) to top. */
  fullPath: string;
};

function segmentPath(from: RankPathPoint, to: RankPathPoint): string {
  // Vertical tangents at both ends give the smooth S-bends between nodes.
  const midY = (from.y + to.y) / 2;
  return `C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
}

function cubicPoint(from: RankPathPoint, to: RankPathPoint, t: number): RankPathPoint {
  const midY = (from.y + to.y) / 2;
  const u = 1 - t;
  // Control points (from.x, midY) and (to.x, midY), matching segmentPath.
  return {
    x: u * u * u * from.x + 3 * u * u * t * from.x + 3 * u * t * t * to.x + t * t * t * to.x,
    y: u * u * u * from.y + 3 * u * u * t * midY + 3 * u * t * t * midY + t * t * t * to.y,
  };
}

const ARC_SAMPLES = 32;

function cubicLength(from: RankPathPoint, to: RankPathPoint): number {
  let length = 0;
  let prev = from;
  for (let step = 1; step <= ARC_SAMPLES; step += 1) {
    const point = cubicPoint(from, to, step / ARC_SAMPLES);
    length += Math.hypot(point.x - prev.x, point.y - prev.y);
    prev = point;
  }
  return length;
}

/** Point `fraction` of the way along a segment, by arc length (not bezier `t`). */
export function pointAlongSegment(segment: RankPathSegment, fraction: number): RankPathPoint {
  const target = Math.max(0, Math.min(1, fraction)) * segment.length;
  let travelled = 0;
  let prev = segment.from;
  for (let step = 1; step <= ARC_SAMPLES; step += 1) {
    const point = cubicPoint(segment.from, segment.to, step / ARC_SAMPLES);
    const piece = Math.hypot(point.x - prev.x, point.y - prev.y);
    if (travelled + piece >= target) {
      const within = piece === 0 ? 0 : (target - travelled) / piece;
      return { x: prev.x + (point.x - prev.x) * within, y: prev.y + (point.y - prev.y) * within };
    }
    travelled += piece;
    prev = point;
  }
  return segment.to;
}

/**
 * Lays the ranks out as a winding trail that climbs the screen: level 1 at the bottom, the
 * top rank at the summit. Pure geometry so it can be computed before the first paint.
 */
export function buildRankPathLayout(
  width: number,
  levelCount: number = PROGRESSION_NAMED_LEVEL_MAX,
): RankPathLayout {
  const center = width / 2;
  const swing = Math.min(width * SWING_RATIO, SWING_MAX);

  const offsets: number[] = [];
  let climbed = 0;
  for (let level = 1; level <= levelCount; level += 1) {
    if (level > 1) {
      const tierChange = levelTierFor(level).id !== levelTierFor(level - 1).id;
      climbed += NODE_GAP + (tierChange ? TIER_GAP : 0);
    }
    offsets.push(climbed);
  }
  const height = TOP_PAD + climbed + BOTTOM_PAD;
  const baseY = TOP_PAD + climbed;

  const nodes: RankPathNode[] = offsets.map((offset, index) => {
    const level = index + 1;
    // Phase-shifted sine: every node sits at least half a swing off-centre, leaving label room.
    // The summit is the exception: it takes centre stage, with its title above it.
    const x =
      level === levelCount
        ? center
        : center + swing * Math.sin((index * Math.PI) / 3 + Math.PI / 6);
    return {
      level,
      tier: levelTierFor(level),
      x,
      y: baseY - offset,
      labelSide: x >= center ? "left" : "right",
    };
  });

  const segments: RankPathSegment[] = [];
  const gates: RankPathGate[] = [];
  for (let index = 1; index < nodes.length; index += 1) {
    const from = nodes[index - 1]!;
    const to = nodes[index]!;
    segments.push({
      fromLevel: from.level,
      tier: from.tier,
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      d: `M ${from.x} ${from.y} ${segmentPath(from, to)}`,
      length: cubicLength(from, to),
    });
    if (to.tier.id !== from.tier.id) {
      let toLevel = to.level;
      while (toLevel < nodes.length && nodes[toLevel]!.tier.id === to.tier.id) toLevel += 1;
      gates.push({ tier: to.tier, y: (from.y + to.y) / 2, fromLevel: to.level, toLevel });
    }
  }

  const first = nodes[0];
  const fullPath = first
    ? [
        `M ${first.x} ${first.y}`,
        ...nodes.slice(1).map((node, i) => segmentPath(nodes[i]!, node)),
      ].join(" ")
    : "";

  return { width, height, nodes, segments, gates, fullPath };
}

/** Background tint for a tier zone: the tier accent mixed into the app's near-black. */
export function tierZoneTint(accent: string, strength = 0.16): string {
  const base = 0x0a;
  const hex = accent.replace("#", "");
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(base + (value - base) * strength)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/** Colours above the summit and below the start, so the screen edges continue the backdrop. */
export function rankPathCapColors(layout: RankPathLayout): { top: string; bottom: string } {
  const summit = layout.nodes.at(-1);
  const start = layout.nodes[0];
  return {
    top: summit ? tierZoneTint(summit.tier.accent, 0.24) : "#0a0a0a",
    bottom: start ? tierZoneTint(start.tier.accent, 0.08) : "#0a0a0a",
  };
}
