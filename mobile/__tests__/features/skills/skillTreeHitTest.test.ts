import { nodeAtPoint, type SkillTreeCamera } from "../../../features/skills/skillTreeHitTest";

const nodes = [
  { id: "center", x: 500, y: 500, size: 88 },
  { id: "mixing", x: 650, y: 500, size: 60 },
  { id: "mixing.eq", x: 790, y: 500, size: 44 },
];

/** A 400×800 viewport showing the canvas centre in its middle. */
function camera(scale: number): SkillTreeCamera {
  return {
    scale,
    translateX: 0,
    translateY: 0,
    viewportWidth: 400,
    viewportHeight: 800,
    canvasSize: 1000,
  };
}

/** Where a canvas point lands on screen for `camera(scale)`. */
function onScreen(x: number, y: number, scale: number) {
  return { x: 200 + (x - 500) * scale, y: 400 + (y - 500) * scale };
}

describe("nodeAtPoint", () => {
  it("finds the node under the finger", () => {
    expect(nodeAtPoint(onScreen(650, 500, 1), camera(1), nodes)).toBe("mixing");
  });

  it("follows the camera when the tree is panned", () => {
    const panned = { ...camera(1), translateX: -150 };

    expect(nodeAtPoint({ x: 200, y: 400 }, panned, nodes)).toBe("mixing");
  });

  it("reaches a small node from a finger's width away when zoomed out", () => {
    const point = onScreen(790, 500, 0.4);

    expect(nodeAtPoint({ x: point.x, y: point.y + 20 }, camera(0.4), nodes)).toBe("mixing.eq");
  });

  it("picks the closer node when two are within reach", () => {
    const between = onScreen(720, 500, 0.3);

    expect(nodeAtPoint({ x: between.x + 4, y: between.y }, camera(0.3), nodes)).toBe("mixing.eq");
  });

  it("finds nothing on empty canvas", () => {
    expect(nodeAtPoint(onScreen(500, 800, 1), camera(1), nodes)).toBeNull();
  });
});
