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

const BRANCH_RING_RADIUS = 340;
const FOCUS_RING_RADII = [560, 780, 1000] as const;
const CURVE_CONTROL_RADIUS = 450;
const CANVAS_PAD = 16;
/** Empty slots between two areas keep their fans visually apart. */
const GAP_SLOTS_PER_BRANCH = 3;

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
    edges.push({
      id: `center-${branch}`,
      branch,
      toId: branch,
      from: origin,
      to: branchPoint,
      path: `M ${origin.x} ${origin.y} L ${branchPoint.x} ${branchPoint.y}`,
      length: Math.hypot(branchPoint.x - origin.x, branchPoint.y - origin.y),
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
      edges.push({
        id: `${branch}-${id}`,
        branch,
        toId: id,
        from: branchPoint,
        to: focusPoint,
        path: `M ${branchPoint.x} ${branchPoint.y} Q ${control.x} ${control.y} ${focusPoint.x} ${focusPoint.y}`,
        length: quadraticCurveLength(branchPoint, control, focusPoint),
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
    node.kind === "branch" ? normalize(cos + tangent.x * 1.35, sin + tangent.y * 1.35) : { x: cos, y: sin };
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

function normalize(x: number, y: number): TreePoint {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
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
