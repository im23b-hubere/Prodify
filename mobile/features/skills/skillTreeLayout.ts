import {
  SKILL_BRANCHES,
  focusesForBranch,
  type SkillBranch,
  type SkillFocusId,
} from "../../constants/skills";

export const CENTER_NODE_SIZE = 88;
export const BRANCH_NODE_SIZE = 60;
export const FOCUS_NODE_SIZE = 44;

const BRANCH_RING_RADIUS = 150;
const INNER_FOCUS_RING_RADIUS = 290;
const OUTER_FOCUS_RING_RADIUS = 380;
const CURVE_CONTROL_RADIUS = 225;
const LABEL_ROOM = 56;
/** Empty slots between two branches keep their fans visually apart. */
const GAP_SLOTS_PER_BRANCH = 1;

export type TreePoint = { x: number; y: number };

export type SkillTreeNodeLayout =
  | { kind: "center"; id: "center"; x: number; y: number; size: number }
  | { kind: "branch"; id: SkillBranch; branch: SkillBranch; x: number; y: number; size: number }
  | { kind: "focus"; id: SkillFocusId; branch: SkillBranch; x: number; y: number; size: number };

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

/**
 * Radial tree: you in the middle, the eight branches around you and each branch's focuses
 * fanning outward. Focuses alternate between two rings so neighbours never collide.
 */
export function buildSkillTreeLayout(): SkillTreeLayout {
  const size = 2 * (OUTER_FOCUS_RING_RADIUS + FOCUS_NODE_SIZE / 2 + LABEL_ROOM);
  const center = size / 2;
  const slotsPerBranch = SKILL_BRANCHES.map(
    (branch) => focusesForBranch(branch).length + GAP_SLOTS_PER_BRANCH,
  );
  const totalSlots = slotsPerBranch.reduce((sum, count) => sum + count, 0);
  const firstBranchMiddle = (focusesForBranch(SKILL_BRANCHES[0]).length - 1) / 2;
  const slotAngle = (slot: number) =>
    -Math.PI / 2 + (2 * Math.PI * (slot - firstBranchMiddle)) / totalSlots;
  const pointAt = (angle: number, radius: number): TreePoint => ({
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  });

  const nodes: SkillTreeNodeLayout[] = [
    { kind: "center", id: "center", x: center, y: center, size: CENTER_NODE_SIZE },
  ];
  const edges: SkillTreeEdgeLayout[] = [];
  let slot = 0;

  for (const branch of SKILL_BRANCHES) {
    const focuses = focusesForBranch(branch);
    const branchAngle = slotAngle(slot + (focuses.length - 1) / 2);
    const branchPoint = pointAt(branchAngle, BRANCH_RING_RADIUS);
    nodes.push({ kind: "branch", id: branch, branch, ...branchPoint, size: BRANCH_NODE_SIZE });
    const centerPoint = { x: center, y: center };
    edges.push({
      id: `center-${branch}`,
      branch,
      toId: branch,
      from: centerPoint,
      to: branchPoint,
      path: `M ${center} ${center} L ${branchPoint.x} ${branchPoint.y}`,
      length: Math.hypot(branchPoint.x - center, branchPoint.y - center),
    });

    focuses.forEach(({ id }, index) => {
      const angle = slotAngle(slot + index);
      const radius = index % 2 === 0 ? INNER_FOCUS_RING_RADIUS : OUTER_FOCUS_RING_RADIUS;
      const focusPoint = pointAt(angle, radius);
      const control = pointAt(angle, CURVE_CONTROL_RADIUS);
      nodes.push({ kind: "focus", id, branch, ...focusPoint, size: FOCUS_NODE_SIZE });
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
    ringRadii: [BRANCH_RING_RADIUS, INNER_FOCUS_RING_RADIUS, OUTER_FOCUS_RING_RADIUS],
    nodes,
    edges,
  };
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
