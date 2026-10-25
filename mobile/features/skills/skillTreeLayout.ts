import {
  SKILL_BRANCHES,
  focusesForBranch,
  type SkillBranch,
  type SkillFocusId,
} from "../../constants/skills";

export const CENTER_NODE_SIZE = 88;
export const BRANCH_NODE_SIZE = 60;
export const FOCUS_NODE_SIZE = 44;

export const RING_GAP = 5;
export const RING_WIDTH = 3;
export const LABEL_GAP = 6;
export const FOCUS_LABEL_WIDTH = 104;
export const FOCUS_LABEL_HEIGHT = 34;
export const BRANCH_LABEL_WIDTH = 150;
export const BRANCH_LABEL_HEIGHT = 20;

/** About as tight as the rings go before names start to touch (75% is the limit). */
const BRANCH_RING_RADIUS = 265;
const FOCUS_RING_RADII = [437, 608, 780] as const;
const CURVE_CONTROL_RADIUS = 351;
const CANVAS_PAD = 16;
/** Empty slots between two areas keep their fans visually apart. */
const GAP_SLOTS_PER_BRANCH = 3;
/**
 * Room left between an edge's end and the ring around the node it joins. Edges stop there
 * instead of at the node's centre, so where many meet, their glow never covers the icon.
 */
const EDGE_RING_CLEARANCE = 4;

export type TreePoint = { x: number; y: number };

export type SkillTreeLabelBox = { x: number; y: number; width: number; height: number };

export type SkillTreeNodeLayout =
  | { kind: "center"; id: "center"; x: number; y: number; size: number }
  | {
      kind: "branch";
      id: SkillBranch;
      branch: SkillBranch;
      x: number;
      y: number;
      size: number;
      label: SkillTreeLabelBox;
    }
  | {
      kind: "focus";
      id: SkillFocusId;
      branch: SkillBranch;
      x: number;
      y: number;
      size: number;
      label: SkillTreeLabelBox;
    };

export type SkillTreeEdgeLayout = {
  id: string;
  branch: SkillBranch;
  /** The node whose unlock lights this edge up. */
  toId: SkillBranch | SkillFocusId;
  from: TreePoint;
  to: TreePoint;
  path: string;
  /** Drawn length, so the edge can be traced in from its start. */
  length: number;
  /** Box the centre line stays inside: a curve never leaves the triangle of its points. */
  bounds: SkillTreeLabelBox;
};

export type SkillTreeLayout = {
  size: number;
  ringRadii: readonly number[];
  nodes: SkillTreeNodeLayout[];
  edges: SkillTreeEdgeLayout[];
};

export function ringRadius(size: number) {
  return size / 2 + RING_GAP + RING_WIDTH;
}

/**
 * Radial tree: you in the middle, the eight areas around you and each area's focuses
 * fanning outward. Focuses cycle three rings so a dense area never packs neighbours together.
 */
export function buildSkillTreeLayout(): SkillTreeLayout {
  const center = canvasRadius() + CANVAS_PAD;
  const size = center * 2;
  const origin: TreePoint = { x: center, y: center };
  const slotsPerBranch = SKILL_BRANCHES.map(
    (branch) => focusesForBranch(branch).length + GAP_SLOTS_PER_BRANCH,
  );
  const totalSlots = slotsPerBranch.reduce((sum, count) => sum + count, 0);
  const firstBranchMiddle = (focusesForBranch(SKILL_BRANCHES[0]).length - 1) / 2;
  const slotAngle = (slot: number) =>
    -Math.PI / 2 + (2 * Math.PI * (slot - firstBranchMiddle)) / totalSlots;
  const pointAt = (angle: number, radius: number): TreePoint => ({
    x: origin.x + Math.cos(angle) * radius,
    y: origin.y + Math.sin(angle) * radius,
  });

  const nodes: SkillTreeNodeLayout[] = [
    { kind: "center", id: "center", x: origin.x, y: origin.y, size: CENTER_NODE_SIZE },
  ];
  const edges: SkillTreeEdgeLayout[] = [];
  let slot = 0;

  for (const branch of SKILL_BRANCHES) {
    const focuses = focusesForBranch(branch);
    const branchAngle = slotAngle(slot + (focuses.length - 1) / 2);
    const branchPoint = pointAt(branchAngle, BRANCH_RING_RADIUS);
    nodes.push({
      kind: "branch",
      id: branch,
      branch,
      ...branchPoint,
      size: BRANCH_NODE_SIZE,
      label: nodeLabel({ ...branchPoint, size: BRANCH_NODE_SIZE, kind: "branch" }, origin),
    });
    const spoke = trimLine(
      origin,
      branchPoint,
      edgeClearance(CENTER_NODE_SIZE),
      edgeClearance(BRANCH_NODE_SIZE),
    );
    edges.push({
      id: `center-${branch}`,
      branch,
      toId: branch,
      from: spoke.start,
      to: spoke.end,
      path: `M ${spoke.start.x} ${spoke.start.y} L ${spoke.end.x} ${spoke.end.y}`,
      length: Math.hypot(spoke.end.x - spoke.start.x, spoke.end.y - spoke.start.y),
      bounds: boxAround([spoke.start, spoke.end]),
    });

    focuses.forEach(({ id }, index) => {
      const angle = slotAngle(slot + index);
      const radius = FOCUS_RING_RADII[index % FOCUS_RING_RADII.length];
      const focusPoint = pointAt(angle, radius);
      const control = pointAt(angle, CURVE_CONTROL_RADIUS);
      nodes.push({
        kind: "focus",
        id,
        branch,
        ...focusPoint,
        size: FOCUS_NODE_SIZE,
        label: nodeLabel({ ...focusPoint, size: FOCUS_NODE_SIZE, kind: "focus" }, origin),
      });
      const curve = trimQuadratic(
        branchPoint,
        control,
        focusPoint,
        edgeClearance(BRANCH_NODE_SIZE),
        edgeClearance(FOCUS_NODE_SIZE),
      );
      edges.push({
        id: `${branch}-${id}`,
        branch,
        toId: id,
        from: curve.start,
        to: curve.end,
        path: `M ${curve.start.x} ${curve.start.y} Q ${curve.control.x} ${curve.control.y} ${curve.end.x} ${curve.end.y}`,
        length: quadraticCurveLength(curve.start, curve.control, curve.end),
        bounds: boxAround([curve.start, curve.control, curve.end]),
      });
    });
    slot += focuses.length + GAP_SLOTS_PER_BRANCH;
  }

  return {
    size,
    ringRadii: [BRANCH_RING_RADIUS, ...FOCUS_RING_RADII],
    nodes,
    edges,
  };
}

function boxAround(points: TreePoint[]): SkillTreeLabelBox {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * One box around several edges, grown by `pad` on every side so thick strokes and round caps
 * stay inside. Lets a layer draw just the part of the canvas its edges cover.
 */
export function edgesBounds(edges: readonly SkillTreeEdgeLayout[], pad: number): SkillTreeLabelBox {
  const left = Math.min(...edges.map((edge) => edge.bounds.x)) - pad;
  const top = Math.min(...edges.map((edge) => edge.bounds.y)) - pad;
  const right = Math.max(...edges.map((edge) => edge.bounds.x + edge.bounds.width)) + pad;
  const bottom = Math.max(...edges.map((edge) => edge.bounds.y + edge.bounds.height)) + pad;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function canvasRadius() {
  const outerRing = FOCUS_RING_RADII[FOCUS_RING_RADII.length - 1];
  const labelReach =
    ringRadius(FOCUS_NODE_SIZE) + LABEL_GAP + FOCUS_LABEL_WIDTH / 2 + FOCUS_LABEL_WIDTH / 2;
  return Math.hypot(outerRing + labelReach, FOCUS_LABEL_HEIGHT / 2);
}

function nodeLabel(
  node: { x: number; y: number; size: number; kind: "branch" | "focus" },
  origin: TreePoint,
): SkillTreeLabelBox {
  const width = node.kind === "branch" ? BRANCH_LABEL_WIDTH : FOCUS_LABEL_WIDTH;
  const height = node.kind === "branch" ? BRANCH_LABEL_HEIGHT : FOCUS_LABEL_HEIGHT;
  const dx = node.x - origin.x;
  const dy = node.y - origin.y;
  const length = Math.hypot(dx, dy) || 1;
  const cos = dx / length;
  const sin = dy / length;
  const tangent = { x: -sin, y: cos };
  const dir =
    node.kind === "branch"
      ? normalize(cos + tangent.x * 1.35, sin + tangent.y * 1.35)
      : { x: cos, y: sin };
  const dirX = dir.x;
  const dirY = dir.y;
  const inwardExtent = Math.abs(dirX) * (width / 2) + Math.abs(dirY) * (height / 2);
  const t = ringRadius(node.size) + LABEL_GAP + inwardExtent;
  return {
    x: node.x + dirX * t - width / 2,
    y: node.y + dirY * t - height / 2,
    width,
    height,
  };
}

/** Below this share of a direction, a name stays centred on that axis. */
const LABEL_HUG_THRESHOLD = 0.35;

export type LabelAlignment = {
  justifyContent: "flex-start" | "center" | "flex-end";
  alignItems: "flex-start" | "center" | "flex-end";
  textAlign: "left" | "center" | "right";
};

/**
 * Where a name sits inside its box. The box is sized for the longest two-line name, so a
 * short name hugs the side that faces its node instead of floating in the middle of the box.
 */
export function labelAlignment(node: TreePoint, box: SkillTreeLabelBox): LabelAlignment {
  const dir = normalize(box.x + box.width / 2 - node.x, box.y + box.height / 2 - node.y);
  const towardNodeX =
    dir.x > LABEL_HUG_THRESHOLD ? "start" : dir.x < -LABEL_HUG_THRESHOLD ? "end" : "center";
  const towardNodeY =
    dir.y > LABEL_HUG_THRESHOLD ? "start" : dir.y < -LABEL_HUG_THRESHOLD ? "end" : "center";
  const flex = { start: "flex-start", center: "center", end: "flex-end" } as const;
  const text = { start: "left", center: "center", end: "right" } as const;
  return {
    alignItems: flex[towardNodeX],
    justifyContent: flex[towardNodeY],
    textAlign: text[towardNodeX],
  };
}

function normalize(x: number, y: number): TreePoint {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function edgeClearance(nodeSize: number) {
  return ringRadius(nodeSize) + EDGE_RING_CLEARANCE;
}

function trimLine(start: TreePoint, end: TreePoint, startCut: number, endCut: number) {
  const dir = normalize(end.x - start.x, end.y - start.y);
  return {
    start: { x: start.x + dir.x * startCut, y: start.y + dir.y * startCut },
    end: { x: end.x - dir.x * endCut, y: end.y - dir.y * endCut },
  };
}

function quadraticPoint(start: TreePoint, control: TreePoint, end: TreePoint, t: number) {
  return {
    x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
    y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
  };
}

/** The curve parameter where the curve first gets `distance` away from `anchor`. */
function quadraticParamAtDistance(
  start: TreePoint,
  control: TreePoint,
  end: TreePoint,
  anchor: TreePoint,
  distance: number,
  fromEnd: boolean,
) {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 30; i += 1) {
    const mid = (low + high) / 2;
    const point = quadraticPoint(start, control, end, mid);
    const away = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    // From the start, distance grows with t; from the end it shrinks.
    if (fromEnd ? away > distance : away < distance) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * The same quadratic curve, cut short at both ends: its end points move in along the curve
 * and the control point is re-derived (blossoming), so the shape doesn't change.
 */
function trimQuadratic(
  start: TreePoint,
  control: TreePoint,
  end: TreePoint,
  startCut: number,
  endCut: number,
) {
  const t0 = quadraticParamAtDistance(start, control, end, start, startCut, false);
  const t1 = quadraticParamAtDistance(start, control, end, end, endCut, true);
  const blossom = (a: number, b: number) => ({
    x: (1 - a) * (1 - b) * start.x + ((1 - a) * b + a * (1 - b)) * control.x + a * b * end.x,
    y: (1 - a) * (1 - b) * start.y + ((1 - a) * b + a * (1 - b)) * control.y + a * b * end.y,
  });
  return { start: blossom(t0, t0), control: blossom(t0, t1), end: blossom(t1, t1) };
}

function quadraticCurveLength(start: TreePoint, control: TreePoint, end: TreePoint, steps = 24) {
  let length = 0;
  let previous = start;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const point = {
      x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
      y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
    };
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

export const SKILL_TREE_LAYOUT = buildSkillTreeLayout();
