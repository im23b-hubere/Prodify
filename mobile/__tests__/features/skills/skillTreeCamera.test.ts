import { focusesForBranch } from "../../../constants/skills";
import {
  MAX_SCALE,
  areaFitCamera,
  focusFitCamera,
  nearestArea,
  nodeOverlayTransform,
  openingCamera,
  overviewCamera,
  projectToScreen,
  toggleZoomCamera,
} from "../../../features/skills/skillTreeCamera";
import { SKILL_TREE_LAYOUT } from "../../../features/skills/skillTreeLayout";

const PHONE = { width: 390, height: 800 };
const DETAIL_LIFT = 110;

function isOnScreen(x: number, y: number, inset = 8) {
  return x >= inset && x <= PHONE.width - inset && y >= inset && y <= PHONE.height - inset;
}

describe("skill tree camera", () => {
  it("fits a dense area onto the phone without scaling the canvas past sharpness", () => {
    const camera = areaFitCamera(SKILL_TREE_LAYOUT, "mixing", PHONE);
    const overview = overviewCamera(SKILL_TREE_LAYOUT, PHONE);

    expect(camera.scale).toBeGreaterThan(overview.scale * 1.8);
    expect(camera.scale).toBeLessThanOrEqual(MAX_SCALE);
  });

  it("lets you lean in close, but not up to a node's designed size", () => {
    expect(MAX_SCALE).toBeCloseTo(0.85);
  });

  it("keeps you, the area and its skills on screen when that area is fitted", () => {
    const camera = areaFitCamera(SKILL_TREE_LAYOUT, "mixing", PHONE);
    const mixingIds = new Set(["center", "mixing", ...focusesForBranch("mixing").map(({ id }) => id)]);

    for (const node of SKILL_TREE_LAYOUT.nodes) {
      if (!mixingIds.has(node.id)) continue;
      const screen = projectToScreen(node, camera, PHONE, SKILL_TREE_LAYOUT.size);
      expect(isOnScreen(screen.x, screen.y)).toBe(true);
    }
  });

  it("looks at a skill with the same zoom as its area, sitting above the detail card", () => {
    const area = areaFitCamera(SKILL_TREE_LAYOUT, "mixing", PHONE, DETAIL_LIFT);
    const focus = focusFitCamera(SKILL_TREE_LAYOUT, "mixing.eq", PHONE, DETAIL_LIFT);
    const eq = SKILL_TREE_LAYOUT.nodes.find((node) => node.id === "mixing.eq");
    const screen = projectToScreen(eq!, focus, PHONE, SKILL_TREE_LAYOUT.size);

    expect(focus.scale).toBeCloseTo(area.scale, 5);
    expect(screen.x).toBeCloseTo(PHONE.width / 2, 0);
    expect(screen.y).toBeCloseTo(PHONE.height / 2 - DETAIL_LIFT, 0);
  });

  it("opens on the fitted area, or the whole tree before anything was trained", () => {
    expect(openingCamera(SKILL_TREE_LAYOUT, "mixing", PHONE)).toEqual(
      areaFitCamera(SKILL_TREE_LAYOUT, "mixing", PHONE),
    );
    expect(openingCamera(SKILL_TREE_LAYOUT, "center", PHONE)).toEqual(
      overviewCamera(SKILL_TREE_LAYOUT, PHONE),
    );
  });

  it("places a screen-space node so its centre matches the projected world point", () => {
    const node = { x: 1400, y: 800, size: 44 };
    const pose = { scale: 0.34, x: 12, y: -40 };
    const overlay = nodeOverlayTransform(node, pose, PHONE, SKILL_TREE_LAYOUT.size);
    const projected = projectToScreen(node, pose, PHONE, SKILL_TREE_LAYOUT.size);

    expect(overlay.translateX + node.size / 2).toBeCloseTo(projected.x);
    expect(overlay.translateY + node.size / 2).toBeCloseTo(projected.y);
    expect(overlay.scale).toBe(pose.scale);
  });

  it("double-tap zooms in on the area under the finger, then back out to the whole tree", () => {
    const mixing = SKILL_TREE_LAYOUT.nodes.find((node) => node.id === "mixing");
    const overview = overviewCamera(SKILL_TREE_LAYOUT, PHONE);
    const zoomedIn = toggleZoomCamera(SKILL_TREE_LAYOUT, overview.scale, mixing!, PHONE);
    const zoomedOut = toggleZoomCamera(SKILL_TREE_LAYOUT, zoomedIn.scale, mixing!, PHONE);

    expect(nearestArea(SKILL_TREE_LAYOUT, mixing!)).toBe("mixing");
    expect(zoomedIn.scale).toBeCloseTo(areaFitCamera(SKILL_TREE_LAYOUT, "mixing", PHONE).scale, 5);
    expect(zoomedOut.scale).toBeCloseTo(overview.scale, 5);
  });
});
