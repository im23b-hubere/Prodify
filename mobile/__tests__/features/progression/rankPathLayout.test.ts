import {
  buildRankPathLayout,
  pointAlongSegment,
  rankPathCapColors,
  tierZoneTint,
} from "../../../features/progression/rankPathLayout";

describe("buildRankPathLayout", () => {
  const layout = buildRankPathLayout(390);

  it("places one node per named level, climbing from level 1 at the bottom", () => {
    expect(layout.nodes).toHaveLength(20);
    expect(layout.nodes[0]?.level).toBe(1);
    for (let index = 1; index < layout.nodes.length; index += 1) {
      expect(layout.nodes[index]!.y).toBeLessThan(layout.nodes[index - 1]!.y);
    }
    const ys = layout.nodes.map((node) => node.y);
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeLessThan(layout.height);
  });

  it("keeps every node off the centre line and inside the screen, labels facing inward", () => {
    for (const node of layout.nodes.slice(0, -1)) {
      expect(Math.abs(node.x - 195)).toBeGreaterThan(20);
      expect(node.x).toBeGreaterThan(60);
      expect(node.x).toBeLessThan(330);
      expect(node.labelSide).toBe(node.x >= 195 ? "left" : "right");
    }
  });

  it("puts the summit centre stage", () => {
    expect(layout.nodes.at(-1)?.x).toBe(195);
  });

  it("links consecutive levels with measurable segments", () => {
    expect(layout.segments).toHaveLength(19);
    for (const segment of layout.segments) {
      expect(segment.d.startsWith("M ")).toBe(true);
      expect(segment.length).toBeGreaterThan(100);
    }
  });

  it("puts a gate between each pair of tiers", () => {
    expect(layout.gates.map((gate) => [gate.tier.id, gate.fromLevel, gate.toLevel])).toEqual([
      ["builder", 5, 8],
      ["engineer", 9, 12],
      ["pro", 13, 16],
      ["legend", 17, 20],
    ]);
    const gate = layout.gates[0]!;
    expect(gate.y).toBeLessThan(layout.nodes[3]!.y);
    expect(gate.y).toBeGreaterThan(layout.nodes[4]!.y);
  });
});

describe("pointAlongSegment", () => {
  const segment = buildRankPathLayout(390).segments[0]!;

  it("runs from the segment start to its end", () => {
    expect(pointAlongSegment(segment, 0)).toEqual(segment.from);
    const end = pointAlongSegment(segment, 1);
    expect(end.x).toBeCloseTo(segment.to.x, 1);
    expect(end.y).toBeCloseTo(segment.to.y, 1);
  });

  it("climbs as the fraction grows", () => {
    const quarter = pointAlongSegment(segment, 0.25);
    const half = pointAlongSegment(segment, 0.5);
    expect(half.y).toBeLessThan(quarter.y);
    expect(quarter.y).toBeLessThan(segment.from.y);
  });
});

describe("rankPathCapColors", () => {
  it("uses the summit tier above and the starting tier below", () => {
    const caps = rankPathCapColors(buildRankPathLayout(390));
    expect(caps.top).toBe(tierZoneTint("#f5d547", 0.24));
    expect(caps.bottom).toBe(tierZoneTint("#e8a35c", 0.08));
  });
});

describe("tierZoneTint", () => {
  it("mixes the accent into the app background", () => {
    expect(tierZoneTint("#0a0a0a")).toBe("#0a0a0a");
    expect(tierZoneTint("#ffffff", 1)).toBe("#ffffff");
    expect(tierZoneTint("#ff0000", 0.5)).toBe("#850505");
  });
});
