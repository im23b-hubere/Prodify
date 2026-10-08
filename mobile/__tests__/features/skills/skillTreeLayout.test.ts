import { SKILL_BRANCHES, SKILL_FOCUSES } from "../../../constants/skills";
import {
  buildSkillTreeLayout,
  labelAlignment,
  type SkillTreeNodeLayout,
} from "../../../features/skills/skillTreeLayout";

const layout = buildSkillTreeLayout();
const origin = { x: layout.size / 2, y: layout.size / 2 };

type LabelBox = { x: number; y: number; width: number; height: number };
type LabeledNode = SkillTreeNodeLayout & { label: LabelBox };

function labeledNodes(): LabeledNode[] {
  return layout.nodes.filter((node): node is LabeledNode => node.kind !== "center" && "label" in node);
}

function labelCenter(box: LabelBox) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Level ring sits 8px outside the circle (gap 5 + stroke 3). */
function ringRadius(node: SkillTreeNodeLayout) {
  return node.size / 2 + 8;
}

function boxesOverlap(a: LabelBox, b: LabelBox, gap: number) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

function circleHitsBox(cx: number, cy: number, radius: number, box: LabelBox, gap: number) {
  const nearestX = Math.min(Math.max(cx, box.x), box.x + box.width);
  const nearestY = Math.min(Math.max(cy, box.y), box.y + box.height);
  return Math.hypot(cx - nearestX, cy - nearestY) < radius + gap;
}

describe("buildSkillTreeLayout", () => {
  it("places you, every branch and every focus exactly once", () => {
    const ids = layout.nodes.map((node) => node.id);

    expect(ids).toEqual(
      expect.arrayContaining(["center", ...SKILL_BRANCHES, ...SKILL_FOCUSES.map(({ id }) => id)]),
    );
    expect(new Set(ids).size).toBe(1 + SKILL_BRANCHES.length + SKILL_FOCUSES.length);
  });

  it("connects every branch to you and every focus to its branch", () => {
    const targets = layout.edges.map((edge) => edge.toId);

    expect(targets).toHaveLength(SKILL_BRANCHES.length + SKILL_FOCUSES.length);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("measures every edge at least as long as the straight line it spans", () => {
    for (const edge of layout.edges) {
      const straight = Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y);
      expect(edge.length).toBeGreaterThanOrEqual(straight - 0.01);
      expect(edge.length).toBeLessThan(straight * 1.5);
    }
  });

  it("places a name on every area and focus, further from you than the node", () => {
    const named = labeledNodes();
    expect(named).toHaveLength(SKILL_BRANCHES.length + SKILL_FOCUSES.length);

    for (const node of named) {
      const name = labelCenter(node.label);
      expect(Math.hypot(name.x - origin.x, name.y - origin.y)).toBeGreaterThan(
        Math.hypot(node.x - origin.x, node.y - origin.y),
      );
    }
  });

  it("keeps rings and names from covering each other", () => {
    const named = labeledNodes();
    expect(named).toHaveLength(SKILL_BRANCHES.length + SKILL_FOCUSES.length);
    for (let i = 0; i < named.length; i += 1) {
      for (let j = i + 1; j < named.length; j += 1) {
        const a = named[i];
        const b = named[j];
        expect(boxesOverlap(a.label, b.label, 4)).toBe(false);
        expect(circleHitsBox(a.x, a.y, ringRadius(a), b.label, 4)).toBe(false);
        expect(circleHitsBox(b.x, b.y, ringRadius(b), a.label, 4)).toBe(false);
      }
    }
  });

  it("fits every node, ring and name inside the canvas", () => {
    for (const node of layout.nodes) {
      const radius = ringRadius(node);
      expect(node.x - radius).toBeGreaterThanOrEqual(0);
      expect(node.y - radius).toBeGreaterThanOrEqual(0);
      expect(node.x + radius).toBeLessThanOrEqual(layout.size);
      expect(node.y + radius).toBeLessThanOrEqual(layout.size);
    }
    const named = labeledNodes();
    expect(named).toHaveLength(SKILL_BRANCHES.length + SKILL_FOCUSES.length);
    for (const node of named) {
      expect(node.label.x).toBeGreaterThanOrEqual(0);
      expect(node.label.y).toBeGreaterThanOrEqual(0);
      expect(node.label.x + node.label.width).toBeLessThanOrEqual(layout.size);
      expect(node.label.y + node.label.height).toBeLessThanOrEqual(layout.size);
    }
  });

  it("pulls a short name against the side of its box that faces the node", () => {
    const box = { x: 100, y: 0, width: 104, height: 34 };
    expect(labelAlignment({ x: 60, y: 17 }, box)).toEqual({
      alignItems: "flex-start",
      justifyContent: "center",
      textAlign: "left",
    });
    expect(labelAlignment({ x: 250, y: 17 }, box)).toMatchObject({
      alignItems: "flex-end",
      textAlign: "right",
    });
    expect(labelAlignment({ x: 152, y: 80 }, box)).toEqual({
      alignItems: "center",
      justifyContent: "flex-end",
      textAlign: "center",
    });
    expect(labelAlignment({ x: 152, y: -40 }, box)).toMatchObject({
      justifyContent: "flex-start",
    });
  });

  it("starts the first branch at the top", () => {
    const firstBranch = layout.nodes.find((node) => node.id === SKILL_BRANCHES[0]);

    expect(firstBranch?.x).toBeCloseTo(layout.size / 2, 0);
    expect(firstBranch!.y).toBeLessThan(layout.size / 2);
  });
});
