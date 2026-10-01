import { SKILL_BRANCHES, SKILL_FOCUSES } from "../../../constants/skills";
import {
  FOCUS_NODE_SIZE,
  buildSkillTreeLayout,
  type SkillTreeNodeLayout,
} from "../../../features/skills/skillTreeLayout";

const layout = buildSkillTreeLayout();

function distance(a: SkillTreeNodeLayout, b: SkillTreeNodeLayout) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

  it("keeps enough room between nodes that labels and rings never collide", () => {
    const nodes = layout.nodes;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const minimumGap = (nodes[i].size + nodes[j].size) / 2 + FOCUS_NODE_SIZE / 2;
        expect(distance(nodes[i], nodes[j])).toBeGreaterThan(minimumGap);
      }
    }
  });

  it("fits every node and its label inside the canvas", () => {
    for (const node of layout.nodes) {
      expect(node.x - node.size / 2).toBeGreaterThanOrEqual(0);
      expect(node.y - node.size / 2).toBeGreaterThanOrEqual(0);
      expect(node.x + node.size / 2).toBeLessThanOrEqual(layout.size);
      expect(node.y + node.size / 2 + 40).toBeLessThanOrEqual(layout.size);
    }
  });

  it("starts the first branch at the top", () => {
    const firstBranch = layout.nodes.find((node) => node.id === SKILL_BRANCHES[0]);

    expect(firstBranch?.x).toBeCloseTo(layout.size / 2, 0);
    expect(firstBranch!.y).toBeLessThan(layout.size / 2);
  });
});
